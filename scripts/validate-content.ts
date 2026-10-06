/** `npm run validate` — schema + cross-reference checks for everything in /content. */
import { loadContentFromDisk } from "../src/content/loadFromDisk";

try {
  const c = loadContentFromDisk();
  console.log(
    `content OK: ${c.regions.length} regions, ${c.maneuvers.length} maneuvers, ${c.cases.length} cases, ${c.markSheets.length} mark sheets`,
  );
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
