import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadSnapshot } from "../load.js";
import { matchScenario } from "../match.js";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
const old = loadSnapshot("2026-04-01", DIR);
const siti = old.users.get("siti").tasks;
const role = (result, year, id) => result.by_year[year].roles.find((r) => r.role_id === id);

// Siti's skills (test data): S_DATA, S_RECON, S_COMM, S_INVEST, S_NEGOT.
// Auditor needs S_INVEST, S_AUDIT, S_REPORT, S_COMM. Analyst needs S_MODEL, S_PRES, S_RECON, S_COMM.

test("her own job is never suggested", () => {
  const r = matchScenario(old, { tasks: siti, scenario: "moderate" });
  assert.deepEqual(r.by_year[2026].roles.map((x) => x.role_id).sort(), ["JOB_ANL", "JOB_AUD"]);
});

test("a person with no work week sees the job they aim for, even if roles.csv marks it as current", () => {
  const ids = (r) => r.by_year[2026].roles.map((x) => x.role_id).sort();
  const grad = { tasks: [], skills: ["S_COMM"], scenario: "moderate" };
  assert.deepEqual(ids(matchScenario(old, grad)), ["JOB_ANL", "JOB_AUD"]);
  const withTarget = matchScenario(old, { ...grad, targetJob: "JOB_AP" });
  assert.deepEqual(ids(withTarget), ["JOB_ANL", "JOB_AP", "JOB_AUD"]);
  assert.deepEqual(withTarget.by_year[2026].roles.filter((r) => r.is_target).map((r) => r.role_id), ["JOB_AP"]);
});

test("a person with a work week never gets their own job back through targetJob", () => {
  const r = matchScenario(old, { tasks: siti, scenario: "moderate", targetJob: "JOB_AP" });
  assert.deepEqual(r.by_year[2026].roles.map((x) => x.role_id).sort(), ["JOB_ANL", "JOB_AUD"]);
});

test("skills gap: have, need and missing", () => {
  const aud = role(matchScenario(old, { tasks: siti, scenario: "moderate" }), 2026, "JOB_AUD");
  assert.equal(aud.have, 2);
  assert.equal(aud.need, 4);
  assert.deepEqual(aud.missing_skill_ids, ["S_AUDIT", "S_REPORT"]);
});

test("hand-worked scores in 2031: only TASK_5 (negotiate, communicate) is left", () => {
  const r = matchScenario(old, { tasks: siti, scenario: "moderate" });
  // Auditor: skills 2/4, leftover 1/2 (S_COMM), outlook 1/2 (TASK_6 not yet, TASK_7 yes) -> 40*.5 + 30*.5 + 30*.5 = 50
  // Analyst: skills 2/4, leftover 1/2, outlook 0 (TASK_8 done; TASK_9 has no data, so it isn't counted) -> 35
  assert.equal(role(r, 2031, "JOB_AUD").score, 50);
  assert.equal(role(r, 2031, "JOB_ANL").score, 35);
  assert.deepEqual(role(r, 2031, "JOB_AUD").parts, { skills: 20, leftover: 15, outlook: 15 });
});

test("the forecast changes the match: tied in 2026, auditor ahead by 2031", () => {
  const r = matchScenario(old, { tasks: siti, scenario: "moderate" });
  assert.equal(role(r, 2026, "JOB_AUD").score, role(r, 2026, "JOB_ANL").score);
  assert.equal(r.by_year[2031].roles[0].role_id, "JOB_AUD");
});

test("skills the person adds count, but only real ones", () => {
  const r = matchScenario(old, { tasks: siti, skills: ["S_AUDIT", "S_MADE_UP"], scenario: "moderate" });
  assert.equal(role(r, 2026, "JOB_AUD").have, 3);
  assert.ok(!r.person_skill_ids.includes("S_MADE_UP"));
});

test("emerging role: none before AI could do any hours, then a real role labelled as an estimate", () => {
  const r = matchScenario(old, { tasks: siti, scenario: "moderate" });
  assert.equal(r.by_year[2026].emerging_role, null);
  const e = r.by_year[2031].emerging_role;
  assert.ok(old.roles.has(e.role_id));
  assert.equal(e.is_estimate, true);
});

test("marketPlanet without SDG data: same ranking, with a note", () => {
  const market = matchScenario(old, { tasks: siti, scenario: "moderate", mode: "market" });
  const planet = matchScenario(old, { tasks: siti, scenario: "moderate", mode: "marketPlanet" });
  assert.deepEqual(planet.by_year[2031].roles.map((x) => x.score), market.by_year[2031].roles.map((x) => x.score));
  assert.match(planet.note, /No SDG links/);
});

// SDG test data: a role link, and a Malaysia status where the given goals are off track.
const sdgLink = (item_id, sdg_target, sign) => ({ item_type: "role", item_id, sdg_target, sign, one_line_reason: "test", source: "test_onet" });
const malaysia = (...offTrack) => ({
  malaysiaSdg: offTrack.map((g) => ({ sdg_goal: g, off_track: true, source: "test_sdsn" })),
  offTrackGoals: new Set(offTrack),
});
const planetRun = (extra) => matchScenario({ ...old, ...extra }, { tasks: siti, scenario: "moderate", mode: "marketPlanet" });

test("marketPlanet: goals Malaysia is off track on count double, and can change the order", () => {
  const sdgLinks = [sdgLink("JOB_ANL", "8.5", "+"), sdgLink("JOB_AUD", "12.2", "-")];
  const r = planetRun({ sdgLinks, ...malaysia("8", "12") });
  assert.equal(r.by_year[2031].roles[0].role_id, "JOB_ANL"); // 35 + 10 = 45 beats 50 - 10 = 40
  assert.equal(role(r, 2031, "JOB_ANL").parts.sdg, 10);
  assert.equal(role(r, 2031, "JOB_ANL").sdg[0].malaysia_off_track, true);
  assert.ok(role(r, 2031, "JOB_ANL").sources.includes("test_sdsn"));
});

test("marketPlanet: a goal Malaysia is on track with counts 5, so close roles keep their order", () => {
  const sdgLinks = [sdgLink("JOB_ANL", "8.5", "+"), sdgLink("JOB_AUD", "12.2", "-")];
  const r = planetRun({ sdgLinks, ...malaysia("4") });
  assert.equal(r.by_year[2031].roles[0].role_id, "JOB_AUD"); // 50 - 5 = 45 beats 35 + 5 = 40
  assert.equal(role(r, 2031, "JOB_ANL").parts.sdg, 5);
  assert.ok(!role(r, 2031, "JOB_ANL").sources.includes("test_sdsn"));
});

test("marketPlanet: several targets of one goal count once, and the total is capped", () => {
  const sdgLinks = [sdgLink("JOB_ANL", "8.2", "+"), sdgLink("JOB_ANL", "8.5", "+"),
    sdgLink("JOB_AUD", "4.4", "+"), sdgLink("JOB_AUD", "8.5", "+"), sdgLink("JOB_AUD", "13.1", "+")];
  const r = planetRun({ sdgLinks, ...malaysia("4", "8", "13") });
  assert.equal(role(r, 2031, "JOB_ANL").parts.sdg, 10); // goal 8 once, not twice
  assert.equal(role(r, 2031, "JOB_AUD").parts.sdg, 15); // 10 + 10 + 10, capped at 15
});

test("marketPlanet without Malaysia status: every goal counts the same, with a note", () => {
  const r = planetRun({ sdgLinks: [sdgLink("JOB_ANL", "8.5", "+")] });
  assert.equal(role(r, 2031, "JOB_ANL").parts.sdg, 5);
  assert.match(r.note, /No Malaysia SDG status/);
});

test("every role card carries sources and is an estimate", () => {
  const r = matchScenario(old, { tasks: siti, scenario: "slowdown" });
  for (const card of r.by_year[2030].roles) {
    assert.ok(card.sources.includes("test_onet") && card.sources.includes("test_slowdown"));
    assert.equal(card.is_estimate, true);
  }
});

test("fairness: name and age never reach matching", () => {
  // matchScenario only receives task ids and hours, so two people with the same week get the same result.
  const arifWithSitisWeek = matchScenario(old, { tasks: [...siti], scenario: "moderate" });
  assert.deepEqual(arifWithSitisWeek, matchScenario(old, { tasks: siti, scenario: "moderate" }));
});

test("a person with no work week is matched on skills and outlook only", () => {
  const now = loadSnapshot("2026-10-20", DIR);
  const r = matchScenario(now, { tasks: [], skills: ["S_COMM", "S_REPORT"], scenario: "moderate" });
  const aud = role(r, 2030, "JOB_AUD");
  assert.equal(aud.parts.leftover, null);
  assert.deepEqual([aud.have, aud.need], [2, 4]);
  assert.ok(r.by_year[2030].roles.every((c) => Number.isFinite(c.score)));
  assert.equal(r.by_year[2030].emerging_role, null);
});

test("the result says whether skills are linked per task or per job", () => {
  assert.equal(matchScenario(old, { tasks: siti, scenario: "moderate" }).skill_links.level, "task");
  const jobLevel = { ...old, skillLinks: "job" };
  assert.equal(matchScenario(jobLevel, { tasks: siti, scenario: "moderate" }).skill_links.is_estimate, false);
});

test("a missing skill in the same ESCO group as one she has counts half", () => {
  // Test data: S_AUDIT (auditor needs it, Siti lacks it) shares a group with S_INVEST (Siti has it).
  const skills = new Map(old.skills);
  skills.set("S_AUDIT", { ...skills.get("S_AUDIT"), group_uri: ["g/investigation"] });
  skills.set("S_INVEST", { ...skills.get("S_INVEST"), group_uri: ["g/investigation"] });
  const aud = role(matchScenario({ ...old, skills }, { tasks: siti, scenario: "moderate" }), 2026, "JOB_AUD");
  assert.deepEqual([aud.have, aud.related, aud.need], [2, 1, 4]);
  assert.deepEqual(aud.related_skill_ids, ["S_AUDIT"]);
  // S_AUDIT is still missing: related skills are easier to learn, not already held.
  assert.deepEqual(aud.missing_skill_ids, ["S_AUDIT", "S_REPORT"]);
  // skills part: (2 + 0.5 x 1) / 4 = 0.625 -> 40 x 0.625 = 25 points (was 20 without groups)
  assert.equal(aud.parts.skills, 25);
});

test("a role with no shared skills ranks after every role with some, even with a higher score", () => {
  const now = loadSnapshot("2026-10-20", DIR);
  // Only the analyst needs S_PRES. In 2031 the auditor's outlook (1/2) gives it more points than the
  // analyst's 1 of 4 skills, but she shares no skill with the auditor.
  const r = matchScenario(now, { tasks: [], skills: ["S_PRES"], scenario: "moderate" });
  const [first, second] = r.by_year[2031].roles;
  assert.deepEqual([first.role_id, first.shares_skills], ["JOB_ANL", true]);
  assert.deepEqual([second.role_id, second.shares_skills], ["JOB_AUD", false]);
  assert.ok(second.score > first.score);
});

test("what's left only names a target role, never another person's current job", () => {
  // An auditor whose leftover skills fit only the AP clerk's list, and JOB_AP is a "current" job.
  const now = loadSnapshot("2026-10-20", DIR);
  const auditor = [{ task_id: "TASK_6", hours: 20 }, { task_id: "TASK_7", hours: 20 }];
  const named = (snap) => {
    const r = matchScenario(snap, { tasks: auditor, scenario: "moderate" });
    return r.years.map((y) => r.by_year[y].emerging_role?.role_id).filter(Boolean);
  };
  assert.deepEqual(named(now), []);
  // The same person, with JOB_AP marked as a target role: now it is named.
  const roles = new Map(now.roles);
  roles.set("JOB_AP", { ...roles.get("JOB_AP"), kind: "target" });
  assert.ok(named({ ...now, roles }).includes("JOB_AP"));
});

test("a task added from another job doesn't hide that job: own job = where most hours are", () => {
  const withAudit = [...siti, { task_id: "TASK_6", hours: 1 }]; // TASK_6 belongs to JOB_AUD
  const r = matchScenario(old, { tasks: withAudit, scenario: "moderate" });
  assert.ok(role(r, 2031, "JOB_AUD"));
  assert.ok(!role(r, 2031, "JOB_AP")); // still her own job
});

test("an added task with no skill links of its own doesn't bring its whole job's skill list", () => {
  // TASK_8 (analyst job) has its own link, S_MODEL. Without it, it would get the job's list (fallback).
  const linked = matchScenario(old, { tasks: [...siti, { task_id: "TASK_8", hours: 1 }], scenario: "moderate" });
  assert.ok(linked.person_skill_ids.includes("S_MODEL"));
  const unlinked = { ...old, ownLinkTaskIds: new Set([...old.ownLinkTaskIds].filter((id) => id !== "TASK_8")),
    taskSkills: new Map(old.taskSkills).set("TASK_8", old.roles.get("JOB_ANL").skill_ids) };
  const r = matchScenario(unlinked, { tasks: [...siti, { task_id: "TASK_8", hours: 1 }], scenario: "moderate" });
  assert.ok(!r.person_skill_ids.includes("S_MODEL") && !r.person_skill_ids.includes("S_PRES"));
});
