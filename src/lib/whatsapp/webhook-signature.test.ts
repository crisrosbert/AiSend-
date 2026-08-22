import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyMetaWebhookSignature } from "./webhook-signature";

// These ran skipped for as long as SETUP_MODE was hardcoded to true —
// which is also how a wide-open webhook reached production unnoticed.
// A skipped test is not a passing test, so they are live now and the
// suite fails if protection is ever silently disabled again.

const SECRET = "test-app-secret";

function signedHeader(body: string, secret: string = SECRET): string {
  const hex = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return `sha256=${hex}`;
}

describe("verifyMetaWebhookSignature", () => {
  let savedSecret: string | undefined;
  let savedSetup: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.META_APP_SECRET;
    savedSetup = process.env.WEBHOOK_SETUP_MODE;
    process.env.META_APP_SECRET = SECRET;
    // CI sets a dummy secret; setup mode must be absent for the strict
    // cases, and the suite must not depend on the ambient value.
    delete process.env.WEBHOOK_SETUP_MODE;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.META_APP_SECRET;
    else process.env.META_APP_SECRET = savedSecret;
    if (savedSetup === undefined) delete process.env.WEBHOOK_SETUP_MODE;
    else process.env.WEBHOOK_SETUP_MODE = savedSetup;
    vi.restoreAllMocks();
  });

  describe("strict mode (the production default)", () => {
    it("accepts a request signed with the correct secret", () => {
      const body = JSON.stringify({ object: "whatsapp_business_account" });
      expect(verifyMetaWebhookSignature(body, signedHeader(body))).toBe(true);
    });

    it("rejects a signature computed with a different secret", () => {
      const body = "{}";
      expect(verifyMetaWebhookSignature(body, signedHeader(body, "wrong"))).toBe(false);
    });

    it("rejects a signature for a different body", () => {
      expect(verifyMetaWebhookSignature("{}", signedHeader("{tampered}"))).toBe(false);
    });

    it("rejects a missing signature header", () => {
      expect(verifyMetaWebhookSignature("{}", null)).toBe(false);
    });

    // A wrong-length header would make timingSafeEqual throw rather than
    // return false, so the length guard has to hold.
    it("rejects malformed headers without throwing", () => {
      for (const header of ["", "sha256=", "sha256=zz", "abc", "sha1=deadbeef"]) {
        expect(verifyMetaWebhookSignature("{}", header)).toBe(false);
      }
    });

    it("rejects everything when META_APP_SECRET is missing", () => {
      delete process.env.META_APP_SECRET;
      const body = "{}";
      expect(verifyMetaWebhookSignature(body, signedHeader(body))).toBe(false);
    });
  });

  describe("setup mode", () => {
    it("lets a mismatched signature through when explicitly enabled", () => {
      process.env.WEBHOOK_SETUP_MODE = "true";
      expect(verifyMetaWebhookSignature("{}", signedHeader("{}", "wrong"))).toBe(true);
    });

    it("lets requests through with no secret configured", () => {
      process.env.WEBHOOK_SETUP_MODE = "true";
      delete process.env.META_APP_SECRET;
      expect(verifyMetaWebhookSignature("{}", null)).toBe(true);
    });

    // The important half: an ambiguous value must fail closed. Someone
    // setting "1" or "yes" should get protection, not a silent hole.
    it("stays strict for any value other than the exact string 'true'", () => {
      for (const value of ["1", "yes", "TRUE", "True", "false", "", " true "]) {
        process.env.WEBHOOK_SETUP_MODE = value;
        expect(verifyMetaWebhookSignature("{}", signedHeader("{}", "wrong"))).toBe(false);
      }
    });
  });
});
