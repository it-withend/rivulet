// Compact JWS signing/verification for Open Badges 3.0 credentials, using
// only node:crypto's Ed25519 support (no JOSE dependency). Ed25519 signs the
// message directly with no separate digest step, so the `algorithm` argument
// to `sign`/`verify` is `null` — see the Node.js crypto docs.
import { sign, verify } from "node:crypto";
import { ISSUER_KID, issuerPrivateKey, issuerPublicKey } from "./keys";

function base64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

/**
 * Signs a credential as a compact JWS: `base64url(header).base64url(payload).base64url(signature)`.
 * Returns null when the issuer key is unconfigured — callers must treat that
 * as "issuer unavailable", never fall back to an unsigned credential.
 */
export function signCredential(credential: unknown): string | null {
  const key = issuerPrivateKey();
  if (!key) return null;

  const header = { alg: "EdDSA" as const, typ: "vc+jwt", kid: ISSUER_KID };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(credential))}`;
  const signature = sign(null, Buffer.from(signingInput, "utf8"), key);
  return `${signingInput}.${signature.toString("base64url")}`;
}

export type VerifyResult =
  | { valid: true; credential: unknown }
  | { valid: false; credential: null };

/** Verifies a compact JWS against the issuer's public key. Never throws. */
export function verifyCredential(jwt: string): VerifyResult {
  const parts = jwt.split(".");
  if (parts.length !== 3) return { valid: false, credential: null };
  const [headerB64, payloadB64, signatureB64] = parts;

  const key = issuerPublicKey();
  if (!key) return { valid: false, credential: null };

  try {
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, "base64url");
    const ok = verify(null, Buffer.from(signingInput, "utf8"), key, signature);
    if (!ok) return { valid: false, credential: null };

    const credential: unknown = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    );
    return { valid: true, credential };
  } catch {
    return { valid: false, credential: null };
  }
}
