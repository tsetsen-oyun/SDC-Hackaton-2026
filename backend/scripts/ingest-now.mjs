// Runs the same thing as the Refresh button, from the terminal, and saves the new snapshot into data/snapshots/.
// Run it once on your laptop, then commit the new folder: it is your proof that the data really came from METR.
//   npm run ingest:now              (from the repo root)
import "dotenv/config";
const engine = await import("../engine/index.js");
engine.snapshot(); // load the starting snapshot
const r = await engine.refreshData();
console.log(JSON.stringify({ ...r, warnings: r.warnings?.length ?? 0 }, null, 2));
if (!r.live) process.exitCode = 1;
