// Tests for live trend ingest (engine/ingest.js + Refresh in engine/index.js).
// Nothing here touches the internet: the "METR file" is built in the test, in METR's documented layout,
// from our own real 2026-10-23 snapshot. So a round trip must reproduce the numbers we already have.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const REAL = fileURLToPath(new URL("../../../data/snapshots/", import.meta.url));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "unbundle-ingest-"));
for (const d of ["2026-03-24", "2026-10-23"]) fs.cpSync(path.join(REAL, d), path.join(TMP, d), { recursive: true });
process.env.SNAPSHOTS_DIR = TMP;

const engine = await import("../index.js");
const ingest = await import("../ingest.js");

const csv = (file) => parse(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true });
const realRows = csv(path.join(REAL, "2026-10-23", "ai_progress.csv"));
const realScen = Object.fromEntries(csv(path.join(REAL, "2026-10-23", "scenarios.csv")).map((r) => [r.scenario_id, r]));

// Builds a file in METR's layout. Dates are left unquoted on purpose, like METR's file, so the parser must cope.
function metrYaml(rows, { all = Number(realScen.moderate.doubling_days), recent = Number(realScen.fast.doubling_days), key = "all_time" } = {}) {
  const lines = ["benchmark_name: METR-Horizon-v1.1", "results:"];
  for (const r of rows) {
    lines.push(
      `  ${r.model}:`,
      "    metrics:",
      "      p50_horizon_length:",
      `        estimate: ${r.horizon_50pct_min}`,
      "      p80_horizon_length:",
      `        estimate: ${r.horizon_80pct_min}`,
      `    release_date: ${r.release_date}`
    );
  }
  lines.push(
    "doubling_time_in_days:",
    `  ${key}:`, `    point_estimate: ${all}`,
    "  from_2023_on:", `    point_estimate: ${recent}`, "    ci_low: 104.4", "    ci_high: 158.0"
  );
  return lines.join("\n") + "\n";
}
const asRows = (rows) => rows.map((r) => ({ ...r, horizon_50pct_min: Number(r.horizon_50pct_min), horizon_80pct_min: Number(r.horizon_80pct_min) }));
const NOW = () => new Date("2026-10-24T05:00:00Z");
const week = () => engine.getProfiles().find((p) => p.user_id === "aisyah").tasks.map(({ task_id, hours }) => ({ task_id, hours }));

test("parse: reads METR's documented layout, including unquoted dates and the stitched doubling key", () => {
  const m = ingest.parseMetr(metrYaml(realRows, { key: "all_time_stitched" }));
  assert.equal(m.models.length, realRows.length);
  assert.equal(m.models[0].release_date, "2019-02-14");
  assert.equal(m.doubling.all_time.point, 187.778);
  assert.equal(m.doubling.from_2023_on.high, 158);
  assert.doesNotThrow(() => ingest.validateMetr(m, NOW()));
});

test("validate: a changed or broken file is refused", () => {
  const tooFew = ingest.parseMetr(metrYaml(realRows.slice(0, 5)));
  assert.throws(() => ingest.validateMetr(tooFew, NOW()), /only 5 usable models/);

  const swapped = ingest.parseMetr(metrYaml(realRows.map((r) => ({ ...r, horizon_50pct_min: r.horizon_80pct_min, horizon_80pct_min: r.horizon_50pct_min }))));
  assert.throws(() => ingest.validateMetr(swapped, NOW()), /swapped/);

  const silly = ingest.parseMetr(metrYaml(realRows, { all: 5 }));
  assert.throws(() => ingest.validateMetr(silly, NOW()), /implausible/);

  assert.throws(() => ingest.parseMetr("hello: world\n"), /no `results` section/);
  assert.throws(() => ingest.parseMetr("results: [unclosed"), /not valid YAML/);
});

test("round trip: our own data written in METR's layout is recognised as 'nothing new'", () => {
  const metr = ingest.parseMetr(metrYaml(realRows));
  engine.useSnapshot("2026-10-23");
  assert.equal(ingest.sameTrend(metr, engine.snapshot()), true);
});

test("Refresh with nothing new: live check ok, same snapshot, nothing written", async () => {
  engine.useSnapshot("2026-10-23");
  const r = await engine.refreshData({ fetcher: async () => metrYaml(realRows), now: NOW });
  assert.deepEqual([r.live, r.changed, r.fallback, r.snapshot_date, r.live_error], [true, false, false, "2026-10-23", null]);
  assert.equal(r.trend, null);
  assert.equal(fs.existsSync(path.join(TMP, "2026-10-24")), false);
});

test("Refresh with new METR data: a new dated snapshot is built, loaded, and the forecast moves", async () => {
  engine.useSnapshot("2026-10-23");
  const before = engine.forecast(week(), "moderate");
  const baseWarnings = [...engine.snapshot().warnings];
  const bigger = [
    ...asRows(realRows),
    { model: "future_model_x", release_date: "2026-10-20", horizon_50pct_min: 3000, horizon_80pct_min: 900 },
  ];
  const r = await engine.refreshData({ fetcher: async () => metrYaml(bigger, { all: 170 }), now: NOW });

  assert.deepEqual([r.live, r.changed, r.snapshot_date, r.previous], [true, true, "2026-10-24", "2026-10-23"]);
  assert.deepEqual(r.trend.new_models, ["future_model_x"]);
  assert.equal(r.trend.frontier_after.model, "future_model_x");
  assert.equal(r.trend.moderate_doubling_days.after, 170);
  assert.equal(r.fetched_at, "2026-10-24T05:00:00.000Z");

  // the new snapshot is a normal one: loads clean, keeps every other file, records where it came from
  const folder = path.join(TMP, "2026-10-24");
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
  assert.equal(manifest.fetched_live, true);
  assert.equal(manifest.derived_from, "2026-10-23");
  assert.equal(manifest.sources.find((s) => s.id === "metr_th_1_1").date_taken, "2026-10-24");
  assert.ok(fs.existsSync(path.join(folder, "metr_benchmark_results_1_1.yaml")));
  assert.equal(fs.readFileSync(path.join(folder, "courses.csv"), "utf8"), fs.readFileSync(path.join(TMP, "2026-10-23", "courses.csv"), "utf8"));
  assert.deepEqual(engine.snapshot().warnings, baseWarnings);
  assert.equal(engine.getSources().fetched_live, true);

  // a stronger frontier model means AI reaches every task sooner
  const after = engine.forecast(week(), "moderate");
  const dated = after.tasks.filter((t) => t.status === "dated");
  assert.ok(dated.length > 0);
  for (const t of dated) {
    const old = before.tasks.find((b) => b.task_id === t.task_id);
    assert.ok(t.mid < old.mid, `${t.task_id} should be earlier: ${t.mid} vs ${old.mid}`);
  }

  // asking again with the same data is "nothing new"
  const again = await engine.refreshData({ fetcher: async () => metrYaml(bigger, { all: 170 }), now: NOW });
  assert.deepEqual([again.live, again.changed, again.snapshot_date], [true, false, "2026-10-24"]);
});

test("Refresh when METR is unreachable or sends rubbish: says so and keeps working", async () => {
  engine.useSnapshot("2026-03-24");
  const down = await engine.refreshData({ fetcher: async () => { throw new Error("Timed out after 8s"); }, now: NOW });
  assert.equal(down.live, false);
  assert.match(down.live_error, /Timed out/);
  assert.equal(down.fallback, false);
  // old behaviour is kept: it still moves forward to the newest saved snapshot
  assert.equal(down.snapshot_date, "2026-10-24");

  engine.useSnapshot("2026-03-24");
  const junk = await engine.refreshData({ fetcher: async () => "<html>Service unavailable</html>", now: NOW });
  assert.equal(junk.live, false);
  assert.match(junk.live_error, /no `results` section|not valid YAML/);
  assert.equal(junk.fallback, false);
});

test("Refresh never overwrites a hand-made snapshot that has today's date", async () => {
  // pretend the 2026-10-24 snapshot was made by hand, not by a live fetch
  const manifestFile = path.join(TMP, "2026-10-24", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, fetched_live: false }));
  const before = fs.readFileSync(path.join(TMP, "2026-10-24", "ai_progress.csv"), "utf8");

  engine.useSnapshot("2026-10-24");
  const bigger = [...asRows(realRows), { model: "m2", release_date: "2026-10-21", horizon_50pct_min: 5000, horizon_80pct_min: 1200 }];
  const r = await engine.refreshData({ fetcher: async () => metrYaml(bigger), now: NOW });
  assert.equal(r.live, true);
  assert.match(r.live_error, /not made by a live fetch/);
  assert.equal(r.changed, false);
  assert.equal(fs.readFileSync(path.join(TMP, "2026-10-24", "ai_progress.csv"), "utf8"), before);
});

test("two clicks at once share one download", async () => {
  engine.useSnapshot("2026-10-23");
  let calls = 0;
  const fetcher = async () => { calls++; await new Promise((res) => setTimeout(res, 30)); return metrYaml(realRows); };
  const [a, b] = await Promise.all([engine.refreshData({ fetcher, now: NOW }), engine.refreshData({ fetcher, now: NOW })]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
});
