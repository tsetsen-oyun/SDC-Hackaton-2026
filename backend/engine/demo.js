// Prints one person's results in the terminal, to check the engine without the server.
//   node engine/demo.js aisyah moderate             (uses data/snapshots/)
//   node engine/demo.js siti moderate --test-data   (uses the made-up test snapshots)
//   add --save to write examples/forecast-<user>.json and examples/match-<user>.json for the pages
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const [userId = "siti", scenario = "moderate"] = args.filter((a) => !a.startsWith("--"));
const testData = args.includes("--test-data");
if (testData) process.env.SNAPSHOTS_DIR = fileURLToPath(new URL("./test/fixtures/snapshots/", import.meta.url));

const engine = await import("./index.js");
if (testData) engine.useSnapshot("2026-04-01");

const person = engine.getProfiles().find((p) => p.user_id === userId);
if (!person) throw new Error(`No person "${userId}" in users.csv`);
// A person with no current job: forecast their target job's tasks, and match on their own skills only.
const noJob = !person.tasks.length;
const tasks = (noJob ? person.target_job_tasks : person.tasks).map(({ task_id, hours }) => ({ task_id, hours }));
const f = engine.forecast(tasks, scenario);
const m = engine.match({ tasks: noJob ? [] : tasks, skills: person.skill_ids, scenario, mode: "market" });

console.log(`${person.display_name} · ${scenario} · snapshot ${f.snapshot_date}${testData ? " (MADE-UP TEST DATA)" : ""}\n`);
for (const t of f.tasks) {
  const when = t.status === "dated" ? `AI could do it ${t.from.toFixed(1)}–${t.to.toFixed(1)}` : t.status === "no_data" ? "No data" : "Unknown task";
  console.log(`  ${String(t.hours).padStart(3)} h  ${(t.name ?? t.task_id).slice(0, 50).padEnd(50)}  ${when}`);
}
console.log("\n  Share of the week AI could do:", noJob
  ? "no work week (no current job)"
  : f.years.map((y) => `${y} ${Math.round(f.by_year[y].share_ai * 100)}%`).join(" · "));
for (const y of [f.years[0], f.years[4], f.years[9]]) {
  const top = m.by_year[y].roles[0];
  const emerging = m.by_year[y].emerging_role?.name ?? "none yet";
  console.log(`  ${y}: top role ${top ? `${top.name} (${top.score}, ${top.have} of ${top.need} skills, ${top.related} related)` : "none"} · emerging: ${emerging}`);
}

if (args.includes("--save")) {
  const dir = new URL("../../examples/", import.meta.url);
  fs.mkdirSync(dir, { recursive: true });
  const note = testData
    ? "MADE-UP TEST DATA: shows the shape of the engine's answer only. Not real results."
    : `Engine output for snapshot ${f.snapshot_date}.`;
  const save = (name, data) => fs.writeFileSync(new URL(name, dir), JSON.stringify({ _note: note, ...data }, null, 2) + "\n");
  save(`forecast-${userId}.json`, f);
  save(`match-${userId}.json`, m);
  console.log(`\n  Saved examples/forecast-${userId}.json and examples/match-${userId}.json`);
}
