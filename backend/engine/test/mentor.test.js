import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadSnapshot } from "../load.js";
import { mentorPairs } from "../mentor.js";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
const now = loadSnapshot("2026-10-20", DIR);
// Siti does tasks 1–5 (skills S_DATA, S_RECON, S_COMM, S_INVEST, S_NEGOT). Grad has no job and skills S_COMM, S_REPORT.
const siti = { tasks: now.users.get("siti").tasks, userId: "siti", scenario: "moderate" };
const grad = { skills: now.users.get("grad").skill_ids, userId: "grad", scenario: "moderate" };
const pairWith = (result, id) => result.pairs.find((p) => p.user_id === id);

test("a person with a work week is paired only with people without one, never with themselves", () => {
  const r = mentorPairs(now, siti);
  assert.deepEqual(r.pairs.map((p) => p.user_id), ["grad"]);
  assert.equal(r.pairs[0].person_side, "senior");
  assert.match(r.consent_note, /both people must say yes/);
});

test("a person without a work week is paired with every senior", () => {
  const r = mentorPairs(now, grad);
  assert.deepEqual(r.pairs.map((p) => p.user_id), ["siti", "arif"]);
  assert.equal(r.pairs[0].person_side, "junior");
});

test("each side brings only skills the other doesn't have", () => {
  const year = mentorPairs(now, siti).pairs[0].by_year[2026];
  assert.deepEqual(year.junior_brings, ["S_REPORT"]);
  assert.ok(!year.senior_brings.includes("S_COMM")); // grad already has it
  assert.ok(year.senior_brings.length > 0);
  assert.equal(year.possible, true);
});

test("the senior brings skills from tasks AI could not do yet, so the list never grows over the years", () => {
  const p = mentorPairs(now, siti).pairs[0];
  const years = Object.keys(p.by_year);
  const first = new Set(p.by_year[years[0]].senior_brings);
  const last = p.by_year[years[years.length - 1]].senior_brings;
  assert.ok(last.every((s) => first.has(s)));
  assert.ok(last.length < first.size);
});

test("the junior's skills that the senior's best next role needs come first", () => {
  // Siti has neither. One is needed by the auditor role, the other by the analyst role.
  const r = mentorPairs(now, { ...grad, skills: ["S_PRES", "S_AUDIT"] });
  const year = pairWith(r, "siti").by_year[2026];
  const top = now.roles.get(year.senior_top_role);
  assert.ok(top.skill_ids.includes(year.junior_brings[0]));
});

test("not a pair when one side has nothing to teach", () => {
  const r = mentorPairs(now, { ...grad, skills: ["S_COMM"] });
  const year = pairWith(r, "siti").by_year[2026];
  assert.deepEqual(year.junior_brings, []);
  assert.equal(year.possible, false);
});

test("fairness: changing names and ages changes nothing", () => {
  const users = new Map([...now.users].map(([id, u]) => [id, { ...u, display_name: "Someone else", display_age: 60 }]));
  assert.deepEqual(mentorPairs({ ...now, users }, siti), mentorPairs(now, siti));
  assert.deepEqual(mentorPairs({ ...now, users }, grad), mentorPairs(now, grad));
});

test("the pair carries sources and is an estimate", () => {
  const p = mentorPairs(now, siti).pairs[0];
  assert.ok(p.sources.includes("test_onet"));
  assert.equal(p.is_estimate, true);
});
