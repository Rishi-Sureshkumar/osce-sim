import { describe, expect, it } from "vitest";
import { authConfig, signToken, verifyToken } from "@/server/authToken";

describe("access token", () => {
  it("round-trips a signed role", async () => {
    const t = await signToken("coach", "s3cret");
    expect(await verifyToken(t, "s3cret")).toBe("coach");
  });
  it("rejects a wrong secret, tampered role, or expired token", async () => {
    const t = await signToken("student", "s3cret");
    expect(await verifyToken(t, "other")).toBeNull();
    expect(await verifyToken(t.replace(/^student/, "coach"), "s3cret")).toBeNull();
    const old = await signToken("student", "s3cret", Date.now() - 13 * 3600 * 1000);
    expect(await verifyToken(old, "s3cret")).toBeNull();
    expect(await verifyToken(undefined, "s3cret")).toBeNull();
  });
  it("is open in dev without codes and fails closed in production", () => {
    expect(authConfig({ NODE_ENV: "development" }).open).toBe(true);
    expect(authConfig({ NODE_ENV: "production" }).misconfigured).toBe(true);
    const ok = authConfig({ NODE_ENV: "production", ACCESS_CODE: "a", COACH_ACCESS_CODE: "b", AUTH_SECRET: "c" });
    expect(ok.open || ok.misconfigured).toBe(false);
  });
});
