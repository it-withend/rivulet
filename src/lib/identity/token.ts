// Server only: uses node:crypto and reads the token hash. Never import this
// from a client component.
import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 32 random bytes, base64url-encoded. Returned to the client exactly once. */
export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

/** sha256 hex digest — the only form of the token stored server-side. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type RequestObserver = { id: string; displayName: string };

/**
 * Resolves the `Authorization: Bearer <token>` header against `observers`.
 * Returns null for a missing, malformed or unknown token — callers decide
 * whether that blocks the request.
 */
export async function observerFromRequest(
  db: SupabaseClient,
  request: Request,
): Promise<RequestObserver | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const { data, error } = await db
    .from("observers")
    .select("id, display_name")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (error || !data) return null;

  return { id: data.id, displayName: data.display_name };
}
