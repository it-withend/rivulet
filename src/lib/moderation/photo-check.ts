/**
 * A cheap, optional sanity check on the photo behind a Forel-Ule reading:
 * "does this look like a photo of open water?" Anti-gaming, not science —
 * it never touches the ecological model, only `validation_status`, the same
 * as the GPS-accuracy and distance-from-waterbody checks in plausibility.ts.
 *
 * Deliberately soft-fail everywhere: a missing key, a network error, a
 * timeout, or a response we cannot parse all mean "skip the check", never
 * "flag it". A submission is never blocked or slowed by this — it is
 * fire-and-forget from the caller's point of view, with a short timeout.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Groq's current vision-capable chat model. If Groq retires this model id,
// the call fails and photoCheck() returns null (skip) — see the try/catch
// below — so an outdated id degrades gracefully rather than breaking
// submissions.
const MODEL = process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const TIMEOUT_MS = 6000;

export type PhotoCheckResult = { isWater: boolean; confidence: "high" | "medium" | "low" };

/**
 * `thumbnail` is a small `data:image/...;base64,...` URI. Returns null
 * whenever the check could not be run or the answer could not be trusted —
 * callers must treat null as "no signal", not as "not water".
 */
export async function photoCheck(thumbnail: string): Promise<PhotoCheckResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
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
        max_tokens: 40,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "A citizen-science app asks residents to photograph the surface of a river, " +
                  "stream or pond for a water-colour reading. Look at this photo and answer " +
                  'strictly as JSON: {"is_water": boolean, "confidence": "high"|"medium"|"low"}. ' +
                  "is_water is true only if the photo clearly shows the surface of a natural or " +
                  "urban body of water (a river, canal, stream, pond). It is false for people, " +
                  "memes, screenshots, indoor scenes, or anything that is not water. Answer only " +
                  "the JSON object, nothing else.",
              },
              { type: "image_url", image_url: { url: thumbnail } },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text) as { is_water?: unknown; confidence?: unknown };
    if (typeof parsed.is_water !== "boolean") return null;
    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
        ? parsed.confidence
        : "low";

    return { isWater: parsed.is_water, confidence };
  } catch {
    // Network error, abort/timeout, or malformed JSON — all treated as "skip".
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
