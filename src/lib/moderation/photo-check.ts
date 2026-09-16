/**
 * A cheap, optional sanity check on the photo behind a Forel-Ule reading:
 * "does this look like a photo of open water?" Anti-gaming, not science —
 * it never touches the ecological model, only `validation_status`, the same
 * as the GPS-accuracy and distance-from-waterbody checks in plausibility.ts.
 *
 * Deliberately soft-fail everywhere: a missing key, a network error, a
 * timeout, or a response we cannot parse all mean "skip the check", never
 * "flag it". A submission is never blocked or slowed beyond the timeout —
 * every skip path is logged (once) so a wrong/retired model id or an auth
 * problem shows up in `vercel logs` / the Vercel dashboard instead of
 * silently doing nothing forever.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Groq's current vision-capable chat model (console.groq.com/docs/vision).
// If Groq retires this id, the call fails and photoCheck() logs why and
// returns null (skip) — see the try/catch below.
const MODEL = process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const TIMEOUT_MS = 8000;

export type PhotoCheckResult = { isWater: boolean; confidence: "high" | "medium" | "low" };

function parseAnswer(text: string): PhotoCheckResult | null {
  // Deliberately not `response_format: json_object`: combining a strict
  // JSON-mode constraint with image input is not consistently supported
  // across vision models, and a 400 from that would silently look like
  // "skip" here. A plain regex over free-form text is more forgiving.
  const isWaterMatch = text.match(/"?is_water"?\s*:\s*(true|false)/i);
  if (!isWaterMatch) return null;
  const confidenceMatch = text.match(/"?confidence"?\s*:\s*"?(high|medium|low)"?/i);
  return {
    isWater: isWaterMatch[1].toLowerCase() === "true",
    confidence: (confidenceMatch?.[1].toLowerCase() as PhotoCheckResult["confidence"]) ?? "low",
  };
}

/**
 * `thumbnail` is a small `data:image/...;base64,...` URI. Returns null
 * whenever the check could not be run or the answer could not be trusted —
 * callers must treat null as "no signal", not as "not water".
 */
export async function photoCheck(thumbnail: string): Promise<PhotoCheckResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null; // Not configured — expected on most deployments.
  if (!thumbnail.startsWith("data:image/")) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "A citizen-science app asks residents to photograph the surface of a river, " +
                  "stream or pond for a water-colour reading. Look at this photo and reply with " +
                  "exactly one line of JSON and nothing else, no markdown fences, no explanation: " +
                  '{"is_water": true or false, "confidence": "high", "medium" or "low"}. ' +
                  "is_water is true only if the photo clearly shows the surface of a natural or " +
                  "urban body of water (a river, canal, stream, pond). It is false for people, " +
                  "memes, screenshots, indoor scenes, or anything that is not water.",
              },
              { type: "image_url", image_url: { url: thumbnail } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`photoCheck: Groq answered ${response.status}: ${await response.text()}`);
      return null;
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) {
      console.error("photoCheck: Groq response had no message content", JSON.stringify(body));
      return null;
    }

    const parsed = parseAnswer(text);
    if (!parsed) {
      console.error("photoCheck: could not parse an is_water answer from:", text);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("photoCheck: request failed:", error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
