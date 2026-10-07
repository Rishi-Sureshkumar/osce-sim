import { describe, expect, it } from "vitest";

describe("no external network in tests", () => {
  it("fetch to an external host throws", async () => {
    await expect(fetch("https://api.anthropic.com/v1/messages")).rejects.toThrow(/no-network/);
    await expect(fetch("https://huggingface.co/")).rejects.toThrow(/no-network/);
  });
});
