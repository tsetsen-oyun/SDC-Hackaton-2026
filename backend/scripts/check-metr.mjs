// Safe check, writes nothing: downloads METR's real file and prints what we would use.
//   npm run ingest:check            (from the repo root)
import { fetchText, parseMetr, validateMetr, frontierOf, METR_URL } from "../engine/ingest.js";

console.log(`Fetching ${METR_URL} ...`);
let text;
try {
  text = await fetchText();
} catch (err) {
  console.error(`\nFAILED: ${err.message}\nCheck your internet connection (or whether this machine blocks metr.org).`);
  process.exit(1);
}
const metr = parseMetr(text);
console.log(`Downloaded ${(text.length / 1024).toFixed(0)} KB. Usable models: ${metr.models.length} (skipped ${metr.skipped} incomplete)`);
console.log("Doubling time, all-time:", metr.doubling.all_time);
console.log("Doubling time, from 2023:", metr.doubling.from_2023_on);
console.log("Frontier (sets the forecast's starting point):", frontierOf(metr.models));
console.log("Newest 5 models:", metr.models.slice(-5).map((m) => `${m.model} (${m.release_date}, 80%: ${m.horizon_80pct_min} min)`));
validateMetr(metr);
console.log("\nAll checks passed. Refresh would accept this file.");
