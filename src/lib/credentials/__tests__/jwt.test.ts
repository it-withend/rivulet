import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { signCredential, verifyCredential } from "../jwt";

describe("signCredential / verifyCredential", () => {
  const original = process.env.RIVULET_ISSUER_PRIVATE_KEY;

  beforeAll(() => {
    // A throwaway Ed25519 key for the test run — never the real issuer key.
    const { privateKey } = generateKeyPairSync("ed25519");
    const der = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
    process.env.RIVULET_ISSUER_PRIVATE_KEY = der.toString("base64");
  });

  afterAll(() => {
    if (original === undefined) delete process.env.RIVULET_ISSUER_PRIVATE_KEY;
    else process.env.RIVULET_ISSUER_PRIVATE_KEY = original;
  });

  it("round-trips a credential through sign and verify", () => {
    const credential = { hello: "world", tier: "contributor" };
    const jwt = signCredential(credential);
    expect(jwt).not.toBeNull();

    const result = verifyCredential(jwt!);
    expect(result.status).toBe("verified");
    expect(result.status === "verified" && result.credential).toEqual(credential);
  });

  it("rejects a credential whose payload was tampered with after signing", () => {
    const jwt = signCredential({ hello: "world", tier: "contributor" });
    expect(jwt).not.toBeNull();

    const [header, , signature] = jwt!.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ hello: "world", tier: "data_steward" }),
    ).toString("base64url");
    const tampered = `${header}.${tamperedPayload}.${signature}`;

    const result = verifyCredential(tampered);
    expect(result.status).toBe("invalid");
  });

  it("reports 'unavailable' rather than 'invalid' when the issuer key is unconfigured", () => {
    // A legitimately-signed credential from *this* run, but verified after
    // the deployment's issuer key has gone missing (e.g. a preview build
    // without the env var). Must never be shown as a tampered/forged
    // signature — that's a different, much worse claim.
    const jwt = signCredential({ hello: "world", tier: "contributor" });
    expect(jwt).not.toBeNull();

    const original = process.env.RIVULET_ISSUER_PRIVATE_KEY;
    delete process.env.RIVULET_ISSUER_PRIVATE_KEY;
    try {
      const result = verifyCredential(jwt!);
      expect(result.status).toBe("unavailable");
    } finally {
      process.env.RIVULET_ISSUER_PRIVATE_KEY = original;
    }
  });
});
