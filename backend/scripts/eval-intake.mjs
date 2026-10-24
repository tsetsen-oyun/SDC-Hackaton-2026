// How good is free-text intake? Compares plain keyword matching with the Groq helper on made-up descriptions
// whose correct tasks we chose by hand from our own task list.
//   npm run eval:intake                      keyword matching only (works offline)
//   GROQ_API_KEY=... npm run eval:intake     keyword matching vs the AI helper (needs a key; uses 8 requests)
//   (RUNPOD_API_KEY works too)
// Report the table in your pitch; it is the evidence that the AI helper adds something.
import "dotenv/config";
import { loadSnapshot, listSnapshots, snapshotsDir } from "../engine/load.js";
import { runIntake, resetIntakeState, intakeInfo } from "../engine/intake.js";

const snap = loadSnapshot(listSnapshots().at(-1));

// expected = task ids a careful person would pick. The last case is out of scope on purpose: nothing should match.
const CASES = [
  { name: "accounts clerk", expected: ["TASK_2487", "TASK_2496", "TASK_2486", "TASK_2498"],
    text: "I record supplier invoices in our accounting software and reconcile the accounts at month end. I check figures for errors and I also answer phones and do filing." },
  { name: "private tutor", expected: ["TASK_17037", "TASK_17027", "TASK_17034", "TASK_17020"],
    text: "I give private lessons to secondary school students, give them feedback on their homework, assess how they are progressing and schedule sessions with their parents." },
  { name: "clinic admin", expected: ["TASK_777", "TASK_775", "TASK_788", "TASK_779", "TASK_781"],
    text: "At a clinic I answer telephones, schedule patient appointments, complete insurance claim forms, greet visitors and direct them to staff, and keep medical records in order." },
  { name: "graphic designer", expected: ["TASK_306", "TASK_299", "TASK_301", "TASK_305", "TASK_23970"],
    text: "I create designs and layouts for logos and websites, use software to generate new images, meet clients to discuss the layout and prepare digital files for printing." },
  { name: "market researcher", expected: ["TASK_5443", "TASK_5433", "TASK_5434", "TASK_5441"],
    text: "I run surveys and opinion polls, analyse customer data and buying habits, prepare reports that show the findings in charts, and track competitors' prices." },
  { name: "customer service", expected: ["TASK_18565", "TASK_2578", "TASK_2581", "TASK_2582"],
    text: "I talk to customers by phone about our products, keep records of their complaints, contact them back with answers, and pass unresolved grievances to the right department." },
  { name: "paraphrased (hard)", expected: ["TASK_777", "TASK_775", "TASK_788"],
    text: "I pick up the phone for the doctors, book people in for scans and operations, and fill in the forms for the insurers." },
  { name: "out of scope", expected: [],
    text: "I drive a lorry and deliver fresh fruit to markets across the country, loading and unloading it myself." },
];
for (const c of CASES) for (const id of c.expected) if (!snap.tasks.has(id)) throw new Error(`Eval case "${c.name}" uses unknown task ${id}`);

async function score(label, env) {
  let tp = 0, fp = 0, fn = 0, strayOnOutOfScope = 0, usedAi = 0;
  const rows = [];
  for (const [i, c] of CASES.entries()) {
    resetIntakeState();
    const r = await runIntake(snap, { text: c.text, env, visitor: `eval-${i}` });
    const got = new Set(r.tasks.map((t) => t.task_id));
    const hit = c.expected.filter((id) => got.has(id)).length;
    const extra = [...got].filter((id) => !c.expected.includes(id)).length;
    if (c.expected.length) { tp += hit; fp += extra; fn += c.expected.length - hit; } else strayOnOutOfScope = extra;
    if (r.source === "llm") usedAi++;
    rows.push(`${c.name.padEnd(20)} found ${hit}/${c.expected.length}  extra ${extra}  (${r.source})`);
  }
  const precision = tp / (tp + fp || 1), recall = tp / (tp + fn || 1);
  console.log(`\n${label}\n${rows.map((r) => "  " + r).join("\n")}`);
  console.log(`  => precision ${(precision * 100).toFixed(0)}%, recall ${(recall * 100).toFixed(0)}%, wrong tasks on the out-of-scope case: ${strayOnOutOfScope}${label !== "Keyword matching only" ? `, answered by AI in ${usedAi}/${CASES.length} cases` : ""}`);
}

console.log(`Snapshot ${snap.date} (${snapshotsDir()}), ${CASES.length} made-up cases`);
await score("Keyword matching only", {});
if (intakeInfo(process.env).enabled) await score(`${intakeInfo(process.env).provider} (${intakeInfo(process.env).model}), every pick checked against our lists`, process.env);
else console.log("\n(Set GROQ_API_KEY or RUNPOD_API_KEY to compare with the AI helper.)");
