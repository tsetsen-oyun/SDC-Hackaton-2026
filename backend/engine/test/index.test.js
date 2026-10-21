import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
process.env.SNAPSHOTS_DIR = DIR;
const engine = await import("../index.js");

const sitiWeek = () => engine.getProfiles().find((p) => p.user_id === "siti").tasks;

test("profiles: Siti's tasks come with their names", () => {
  engine.useSnapshot("2026-04-01");
  const tasks = sitiWeek();
  assert.equal(tasks.length, 5);
  assert.equal(tasks[1].name, "Match invoices to purchase orders");
});

test("forecast and match work with the inputs the server sends", () => {
  engine.useSnapshot("2026-04-01");
  const f = engine.forecast(sitiWeek(), "moderate");
  assert.equal(f.by_year[2027].hours_ai, 12);
  const m = engine.match({ tasks: sitiWeek(), skills: [], scenario: "moderate", mode: "market" });
  assert.equal(m.by_year[2031].roles[0].role_id, "JOB_AUD");
});

test("Refresh moves to the newest snapshot and the results change", async () => {
  engine.useSnapshot("2026-04-01");
  const before = engine.forecast(sitiWeek(), "moderate");
  const r = await engine.refreshData();
  assert.deepEqual([r.previous, r.snapshot_date, r.changed, r.fallback], ["2026-04-01", "2026-10-20", true, false]);
  assert.notDeepEqual(engine.forecast(sitiWeek(), "moderate").tasks, before.tasks);
});

test("Refresh that fails keeps the current snapshot", async () => {
  engine.useSnapshot("2026-04-01");
  process.env.SNAPSHOTS_DIR = fileURLToPath(new URL("./fixtures/does-not-exist/", import.meta.url));
  const r = await engine.refreshData();
  process.env.SNAPSHOTS_DIR = DIR;
  assert.equal(r.fallback, true);
  assert.equal(r.snapshot_date, "2026-04-01");
  assert.equal(engine.getSources().snapshot_date, "2026-04-01");
});

test("sources list everything the About page needs", () => {
  engine.useSnapshot("2026-10-20");
  const s = engine.getSources();
  assert.equal(s.llm_model_used, null);
  assert.ok(s.sources.some((x) => x.id === "test_metr"));
  assert.deepEqual(s.scenarios.map((x) => x.id), ["moderate", "fast", "slowdown"]);
});

test("route says it isn't ready instead of guessing courses", () => {
  assert.equal(engine.buildRoute({ jobId: "JOB_AUD", skills: [], scenario: "moderate" }).status, "not_ready");
});

test("bad task input is a clear error", () => {
  assert.throws(() => engine.forecast("TASK_1", "moderate"), /tasks must be a list/);
});

test("profiles: a person with no current job gets the target job's tasks, with no week share", () => {
  engine.useSnapshot("2026-10-20");
  const grad = engine.getProfiles().find((p) => p.user_id === "grad");
  assert.equal(grad.target_job_name, "Auditor (test)");
  assert.deepEqual(grad.target_job_tasks.map((t) => [t.task_id, t.hours]), [["TASK_6", 0], ["TASK_7", 0]]);
  const f = engine.forecast(grad.target_job_tasks, "moderate");
  assert.equal(f.by_year[2030].share_ai, null);
  assert.ok(f.tasks.every((t) => t.sources));
  assert.deepEqual(engine.getProfiles().find((p) => p.user_id === "siti").target_job_tasks, []);
});
