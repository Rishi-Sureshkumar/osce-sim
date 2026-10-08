/** M1: the precomputed phrase vectors match the content (re-run `npm run lang:embed` when this fails). */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { expectedPhrases, phraseHash } from "../scripts/lang/embed";

describe("src/lang/generated is up to date", () => {
  for (const [file, phrases] of expectedPhrases()) {
    it(file, () => {
      const f = path.join(process.cwd(), "src/lang/generated", file);
      expect(fs.existsSync(f), `${file} is missing: run npm run lang:embed`).toBe(true);
      const g = JSON.parse(fs.readFileSync(f, "utf8")) as { hash: string };
      expect(g.hash, `${file} is stale: content changed since the last npm run lang:embed`).toBe(phraseHash(phrases));
    });
  }
});
