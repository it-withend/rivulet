import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAuthorisedModerator } from "../auth";

function requestWith(token: string | null): Request {
  const headers = new Headers();
  if (token !== null) headers.set("x-moderator-token", token);
  return new Request("http://localhost/api/moderation/observations", { headers });
}

describe("isAuthorisedModerator", () => {
  const original = process.env.RIVULET_MODERATOR_TOKEN;
  afterEach(() => {
    process.env.RIVULET_MODERATOR_TOKEN = original;
  });

  it("refuses every request when no token is configured", () => {
    delete process.env.RIVULET_MODERATOR_TOKEN;
    expect(isAuthorisedModerator(requestWith("anything"))).toBe(false);
  });

  it("refuses a request with no header", () => {
    process.env.RIVULET_MODERATOR_TOKEN = "secret-phrase";
    expect(isAuthorisedModerator(requestWith(null))).toBe(false);
  });

  it("refuses the wrong passphrase", () => {
    process.env.RIVULET_MODERATOR_TOKEN = "secret-phrase";
    expect(isAuthorisedModerator(requestWith("wrong"))).toBe(false);
  });

  it("accepts the configured passphrase", () => {
    process.env.RIVULET_MODERATOR_TOKEN = "secret-phrase";
    expect(isAuthorisedModerator(requestWith("secret-phrase"))).toBe(true);
  });
});
