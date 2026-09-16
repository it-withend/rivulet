// Server only: reads the Ed25519 issuer private key and derives the public
// key/JWK from it using node:crypto. Never import this from a client
// component, and never log or return the private key material itself.
import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";

/**
 * Stable key identifier embedded in every signed credential's JWS header and
 * in the published JWK, so a verifier can match the two. There is a single
 * issuer key for this prototype, so a fixed id (rather than a computed
 * thumbprint) is enough.
 */
export const ISSUER_KID = "rivulet-issuer-1";

function loadPrivateKey(): KeyObject | null {
  const encoded = process.env.RIVULET_ISSUER_PRIVATE_KEY;
  if (!encoded) return null;
  try {
    const der = Buffer.from(encoded, "base64");
    return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  } catch {
    return null;
  }
}

/** The Ed25519 issuer private key, or null if unconfigured/invalid. */
export function issuerPrivateKey(): KeyObject | null {
  return loadPrivateKey();
}

/** The Ed25519 issuer public key, derived from the private key. */
export function issuerPublicKey(): KeyObject | null {
  const priv = loadPrivateKey();
  if (!priv) return null;
  try {
    return createPublicKey(priv);
  } catch {
    return null;
  }
}

export type PublicJwk = {
  kty: string;
  crv: string;
  x: string;
  kid: string;
  alg: "EdDSA";
  use: "sig";
};

/** The public key as a JWK, ready to publish at `/api/issuer/jwks`. */
export function publicJwk(): PublicJwk | null {
  const pub = issuerPublicKey();
  if (!pub) return null;
  const jwk = pub.export({ format: "jwk" }) as { kty: string; crv: string; x: string };
  return { ...jwk, kid: ISSUER_KID, alg: "EdDSA", use: "sig" };
}
