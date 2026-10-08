import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BpGauge } from "@/exam3d/tools/BpGauge";

describe("BpGauge (static render)", () => {
  it("renders the dial, controls, record form and test ids without a popup role", () => {
    const html = renderToStaticMarkup(createElement(BpGauge, { onRecord: () => {}, onClose: () => {}, frozen: true }));
    for (const id of ["bp-gauge", "bp-pressure", "bp-status", "bp-squeeze", "bp-read", "bp-valve-closed", "bp-valve-slow", "bp-valve-open", "bp-record", "bp-error"]) {
      expect(html).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain("Systolic (mmHg)");
    expect(html).toContain("Diastolic (mmHg)");
    expect(html).toContain('aria-label="Close"');
    expect(html).toContain(">Read gauge<");
    // the readout changes every 2 mmHg: it must not be a live region (it would talk over the taps)
    expect(html).toMatch(/<p class="[^"]*" data-testid="bp-pressure">0 mmHg</);
    // discrete announcements go to an empty, visually hidden status region
    expect(html).toMatch(/<p role="status" class="sr-only" data-testid="bp-status"><\/p>/);
    // the form validates itself (no native bubbles), and the error text is a polite live region
    expect(html).toMatch(/<form[^>]*novalidate=""/i);
    expect(html).toMatch(/<p id="[^"]+-error"[^>]*aria-live="polite"[^>]*data-testid="bp-error">/);
    expect(html).not.toContain("aria-invalid");
    expect(html).toMatch(/aria-pressed="true"[^>]*data-testid="bp-valve-closed"|data-testid="bp-valve-closed"[^>]*aria-pressed="true"/);
    expect(html).not.toMatch(/role="dialog"|aria-modal/);
    // 0–300 mmHg every 2 mmHg = 151 ticks, plus the needle; labels every 20
    expect(html.match(/<line /g)!.length).toBe(152);
    expect(html.match(/<text /g)!.length).toBe(16 + 1);
    expect(html).toContain(">300</text>");
  });
});
