import { createHash, timingSafeEqual } from "node:crypto";

/**
 * There are no moderator accounts (see migration 0009) — a two-person
 * hackathon team is not a platform. Moderation is gated by a single shared
 * secret, `RIVULET_MODERATOR_TOKEN`, checked here and never sent to the
 * browser. Hashing both sides to a fixed-length digest before comparing
 * keeps the check constant-time regardless of the token's actual length.
 */
export function isAuthorisedModerator(request: Request): boolean {
  const expected = process.env.RIVULET_MODERATOR_TOKEN;
  if (!expected) return false; // moderation is off until this is configured

  const provided = request.headers.get("x-moderator-token");
  if (!provided) return false;

  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
