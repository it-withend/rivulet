import { describe, it, expect, vi, afterEach } from "vitest";
import { photoCheck } from "../photo-check";

const THUMB = "data:image/jpeg;base64,AAAA";

describe("photoCheck", () => {
  const originalKey = process.env.GROQ_API_KEY;
  afterEach(() => {
    process.env.GROQ_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("skips (returns null) when no API key is configured — never blocks submission", async () => {
    delete process.env.GROQ_API_KEY;
    expect(await photoCheck(THUMB)).toBeNull();
  });

  it("skips on a network error rather than throwing", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await photoCheck(THUMB)).toBeNull();
  });

  it("parses a confident 'not water' answer", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"is_water": false, "confidence": "high"}' } }],
        }),
      }),
    );
    expect(await photoCheck(THUMB)).toEqual({ isWater: false, confidence: "high" });
  });
});
