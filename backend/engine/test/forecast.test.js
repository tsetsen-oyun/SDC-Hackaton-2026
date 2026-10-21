import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadSnapshot } from "../load.js";
import { toDecimalYear, buildContext, crossoverYear, forecastScenario } from "../forecast.js";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
const old = loadSnapshot("2026-04-01", DIR);
const now = loadSnapshot("2026-10-20", DIR);
const siti = old.users.get("siti").tasks;
const task = (id, result) => result.tasks.find((t) => t.task_id === id);

// Test data: newest model = 60 min at 2026.0, office-work factor 50, moderate pace = 1 doubling a year.
// So a task of 1.2 min counts as 60 min (already reachable), and each doubling after that adds a year.

test("dates become decimal years", () => {
  assert.equal(toDecimalYear("2026-01-01"), 2026);
  assert.equal(toDecimalYear("2026-07-02"), 2026 + 182 / 365);
  assert.equal(toDecimalYear("2024-12-31"), 2024 + 365 / 366);
});

test("starts from the model with the longest 80% horizon", () => {
  const ctx = buildContext(old);
  assert.equal(ctx.h0, 60);
  assert.equal(ctx.t0, 2026);
  assert.equal(ctx.D, 50);
  assert.equal(ctx.adoption, 0);
});

test("moderate pace: hand-worked dates", () => {
  const r = forecastScenario(old, siti, "moderate");
  assert.deepEqual([task("TASK_1", r).from, task("TASK_1", r).to, task("TASK_1", r).mid], [2026, 2028, 2027]);
  assert.deepEqual([task("TASK_4", r).from, task("TASK_4", r).to, task("TASK_4", r).mid], [2030, 2032, 2031]);
});

test("fast pace halves the time to each date", () => {
  const r = forecastScenario(old, siti, "fast");
  assert.deepEqual([task("TASK_1", r).from, task("TASK_1", r).to], [2026, 2027]);
});

test("office-work switch off: short tasks are already within reach", () => {
  const r = forecastScenario(old, siti, "moderate", { officeWork: false });
  assert.equal(task("TASK_1", r).to, 2026);
  assert.equal(r.assumptions.domain_discount, 1);
});

test("slowdown: hand-worked point between today and the 1-week milestone", () => {
  // TASK_1 high = 4.8 min -> 240 METR-minutes. Curve: (log2 60, 2026) to (log2 2400, 2026 + log2 40 + 5).
  const ctx = buildContext(old);
  const expected = 2026 + (2 / Math.log2(40)) * (Math.log2(40) + 5);
  assert.ok(Math.abs(crossoverYear(4.8, old.scenarios.get("slowdown"), ctx) - expected) < 1e-9);
});

test("longer tasks never come out earlier, in every scenario", () => {
  const ctx = buildContext(old);
  const lengths = [0.5, 1.2, 3, 10, 40, 48, 100, 300, 1000, 5000];
  for (const s of old.scenarios.values()) {
    const years = lengths.map((m) => crossoverYear(m, s, ctx));
    for (let i = 1; i < years.length; i++) assert.ok(years[i] >= years[i - 1], `${s.scenario_id} at ${lengths[i]} min`);
  }
});

test("fast is never later, and slowdown never earlier, than moderate", () => {
  const ctx = buildContext(old);
  const [moderate, fast, slow] = ["moderate", "fast", "slowdown"].map((id) => old.scenarios.get(id));
  for (const m of [0.5, 1.2, 3, 10, 40, 48, 100, 300, 1000, 5000]) {
    const n = crossoverYear(m, moderate, ctx);
    assert.ok(crossoverYear(m, fast, ctx) <= n);
    assert.ok(crossoverYear(m, slow, ctx) >= n);
  }
});

test("a task with no data is never counted as AI could do", () => {
  const r = forecastScenario(old, siti, "moderate");
  assert.equal(task("TASK_5", r).status, "no_data");
  assert.equal(r.by_year[2035].hours_no_data, 4);
  assert.ok(r.by_year[2035].leftover_task_ids.includes("TASK_5"));
});

test("Siti's week, year by year", () => {
  const r = forecastScenario(old, siti, "moderate");
  const hours = r.years.map((y) => r.by_year[y].hours_ai);
  // TASK_1 (12 h) from 2027, TASK_2 (10 h) 2028, TASK_3 (6 h) 2029, TASK_4 (8 h) 2031; TASK_5 (4 h) never.
  assert.deepEqual(r.years, [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035]);
  assert.deepEqual(hours, [0, 12, 22, 28, 28, 36, 36, 36, 36, 36]);
  assert.equal(r.by_year[2027].share_ai, 0.3);
});

test("every dated task carries sources and is marked as an estimate", () => {
  const r = forecastScenario(old, siti, "moderate");
  for (const t of r.tasks.filter((t) => t.status === "dated")) {
    assert.ok(t.sources.includes("test_metr") && t.sources.includes("test_aei") && t.sources.includes("test_domains"));
    assert.equal(t.is_estimate, true);
  }
});

test("Refresh: the newer snapshot gives different results", () => {
  const before = forecastScenario(old, siti, "moderate");
  const after = forecastScenario(now, siti, "moderate");
  assert.notDeepEqual(before.tasks, after.tasks);
  assert.equal(task("TASK_5", after).status, "dated");
  assert.equal(after.start.model, "Test model C");
});

test("an unknown scenario is a clear error", () => {
  assert.throws(() => forecastScenario(old, siti, "pause"), /Unknown scenario "pause"/);
});
