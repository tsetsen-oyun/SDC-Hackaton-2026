import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadSnapshot } from "../load.js";
import { skillTimeline, skillLabel, skillCards } from "../skills.js";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
const old = loadSnapshot("2026-04-01", DIR);
const siti = old.users.get("siti").tasks;
const timeline = skillTimeline(old);
const card = (result, year, id) => result.by_year[year].find((c) => c.skill_id === id);

// Test data, year AI could do the last task using the skill (fast / moderate / slowdown):
// S_DATA 2027 / 2028 / 2029.9 · S_INVEST 2029 / 2032 / 2037.7
test("robust = still human after the year in every scenario, bet = only in some, trap = in none", () => {
  assert.equal(skillLabel(old, timeline, "S_INVEST", 2028), "robust");
  assert.equal(skillLabel(old, timeline, "S_DATA", 2028), "bet");
  assert.equal(skillLabel(old, timeline, "S_DATA", 2030), "trap");
});

test("a skill used only by tasks with no published time gets no label, never 'robust'", () => {
  // S_NEGOT is only used by TASK_5, which has no time in the test data.
  assert.equal(timeline.has("S_NEGOT"), false);
  assert.equal(skillLabel(old, timeline, "S_NEGOT", 2030), null);
  const c = card(skillCards(old, siti, "moderate"), 2030, "S_NEGOT");
  assert.equal(c.label, null);
  assert.equal(c.weather, null);
});

test("weather: steady at the start, then rising for skills of tasks still human, declining for the rest", () => {
  const r = skillCards(old, siti, "moderate");
  assert.ok(r.by_year[2026].every((c) => c.weather === null || c.weather === "steady"));
  assert.equal(card(r, 2029, "S_INVEST").weather, "rising");
  assert.equal(card(r, 2029, "S_DATA").weather, "declining");
});

test("cards are robust first, then bet, then trap, then no data", () => {
  const order = { robust: 0, bet: 1, trap: 2, null: 3 };
  const labels = skillCards(old, siti, "moderate").by_year[2029].map((c) => order[c.label]);
  assert.deepEqual(labels, [...labels].sort((a, b) => a - b));
});

test("a person with no work week gets the skills of the tasks shown, each counting the same", () => {
  const r = skillCards(old, [{ task_id: "TASK_6", hours: 0 }, { task_id: "TASK_7", hours: 0 }], "moderate");
  assert.equal(r.skills_from, "tasks_shown");
  assert.deepEqual(r.by_year[2026].map((c) => c.skill_id).sort(), ["S_AUDIT", "S_INVEST", "S_REPORT"]);
});

test("every card carries sources and is an estimate", () => {
  const c = card(skillCards(old, siti, "slowdown"), 2030, "S_INVEST");
  assert.ok(c.sources.includes("test_metr") && c.sources.includes("test_slowdown"));
  assert.equal(c.is_estimate, true);
});
