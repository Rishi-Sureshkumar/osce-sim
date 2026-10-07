/**
 * Dialog contract, static half (the e2e half is e2e/dialogs.spec.ts): no hand-made popups outside
 * src/components/ui/Overlay.tsx, and every registered dialog id is actually used.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DIALOG_IDS } from "@/components/ui/dialogIds";

const ROOT = path.join(process.cwd(), "src");
const OVERLAY = path.join(ROOT, "components/ui/Overlay.tsx");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.tsx?$/.test(d.name) ? [p] : [];
  });
}
const files = walk(ROOT).filter((f) => f !== OVERLAY && !f.startsWith(path.join(ROOT, "app/dev")));

describe("dialog contract (static)", () => {
  it("no role=dialog/menu, aria-modal or fixed inset-0 backdrop outside Overlay.tsx", () => {
    const bad: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      src.split("\n").forEach((line, i) => {
        if (/role=["'{](dialog|alertdialog|menu)["'}]|aria-modal|\bfixed\s+inset-0\b/.test(line)) bad.push(`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it("every DIALOG_IDS entry is rendered somewhere, and every rendered id is registered", () => {
    const all = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const id of DIALOG_IDS) expect(all.includes(`"${id}"`), id).toBe(true);
    const used = [...all.matchAll(/<Dialog\s+id="([^"]+)"/g)].map((m) => m[1]!);
    for (const id of used) expect(DIALOG_IDS as readonly string[], id).toContain(id);
  });

  it("the e2e spec has an opener for every dialog (typecheck enforces it via `satisfies`)", () => {
    const spec = fs.readFileSync(path.join(process.cwd(), "e2e/dialogs.spec.ts"), "utf8");
    expect(spec).toMatch(/satisfies Record<DialogId, Opener>/);
  });
});
