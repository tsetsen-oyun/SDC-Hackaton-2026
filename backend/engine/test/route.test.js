import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadSnapshot } from "../load.js";
import { routeFor, HOURS_PER_WEEK } from "../route.js";
import { skillTimeline, skillLabel } from "../skills.js";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
const old = loadSnapshot("2026-04-01", DIR);

// Siti's skills (test data). The auditor needs S_INVEST, S_AUDIT, S_REPORT, S_COMM, so she misses S_AUDIT and S_REPORT.
const siti = ["S_DATA", "S_RECON", "S_COMM", "S_INVEST", "S_NEGOT"];
const course = (id, skill_id, hours) => ({
  course_id: id, skill_id, course_name: `Course ${id}`, provider: "Test", link: "https://example.org",
  hours, stated_duration: hours === null ? "4 weeks" : null, cost: "Free",
  hrd_corp_claimable: "unknown", date_checked: "2026-10-21", source: "test_onet",
});
const withCourses = (courses, skills = old.skills) => ({ ...old, courses, skills });

test("without courses.csv the route says it isn't ready, instead of guessing courses", () => {
  assert.equal(routeFor(old, { jobId: "JOB_AUD", skills: siti }).status, "not_ready");
});

test("the skills of the person's tasks count as skills they have, and stop counting when the task is removed", () => {
  const snap = withCourses([course("C1", "S_AUDIT", 10), course("C2", "S_REPORT", 6), course("C3", "S_INVEST", 4)]);
  const sitiWeek = old.users.get("siti").tasks;
  const steps = (tasks) => routeFor(snap, { jobId: "JOB_AUD", skills: [], tasks }).steps.map((s) => s.skill_id).sort();
  // TASK_4 is the only one of her tasks that uses S_INVEST.
  assert.deepEqual(steps(sitiWeek), ["S_AUDIT", "S_REPORT"]);
  assert.deepEqual(steps(sitiWeek.filter((t) => t.task_id !== "TASK_4")), ["S_AUDIT", "S_INVEST", "S_REPORT"]);
});

test("one step per missing skill, each with its real course", () => {
  const r = routeFor(withCourses([course("C1", "S_AUDIT", 10), course("C2", "S_REPORT", 6)]), { jobId: "JOB_AUD", skills: siti });
  assert.deepEqual(r.steps.map((s) => [s.order, s.skill_id, s.course.course_id]), [[1, "S_AUDIT", "C1"], [2, "S_REPORT", "C2"]]);
  assert.equal(r.total_hours, 16);
  assert.equal(r.total_weeks, Math.ceil(16 / HOURS_PER_WEEK));
});

test("a missing skill related to one she has comes first", () => {
  // S_REPORT shares an ESCO group with S_COMM (she has it); S_AUDIT doesn't.
  const skills = new Map(old.skills);
  skills.set("S_REPORT", { ...skills.get("S_REPORT"), group_uri: ["g/writing"] });
  skills.set("S_COMM", { ...skills.get("S_COMM"), group_uri: ["g/writing"] });
  const r = routeFor(withCourses([course("C1", "S_AUDIT", 10), course("C2", "S_REPORT", 6)], skills), { jobId: "JOB_AUD", skills: siti });
  assert.deepEqual(r.steps.map((s) => [s.skill_id, s.related]), [["S_REPORT", true], ["S_AUDIT", false]]);
});

test("a skill with no course is listed as such, never given a made-up course", () => {
  const r = routeFor(withCourses([course("C1", "S_AUDIT", 10)]), { jobId: "JOB_AUD", skills: siti });
  assert.deepEqual(r.steps.map((s) => s.skill_id), ["S_AUDIT"]);
  assert.deepEqual(r.no_course_skill_ids, ["S_REPORT"]);
});

test("a course with no stated hours is left out of the total and counted, never guessed", () => {
  const r = routeFor(withCourses([course("C1", "S_AUDIT", 10), course("C2", "S_REPORT", null)]), { jobId: "JOB_AUD", skills: siti });
  assert.equal(r.total_hours, 10);
  assert.equal(r.courses_without_hours, 1);
});

test("with a scenario, the skill that stays human longest comes first, with labels per year", () => {
  // S_AUDIT stays human until 2032 under moderate, S_REPORT until 2030.
  const r = routeFor(withCourses([course("C1", "S_AUDIT", 10), course("C2", "S_REPORT", 6)]), { jobId: "JOB_AUD", skills: siti, scenario: "moderate" });
  assert.deepEqual(r.steps.map((s) => s.skill_id), ["S_AUDIT", "S_REPORT"]);
  assert.equal(r.steps[0].label_by_year[2028], "robust");
  assert.equal(r.steps[1].label_by_year[2034], "trap");
});

test("stop investing: her skills that are a trap that year and that the role doesn't need", () => {
  const r = routeFor(withCourses([course("C1", "S_AUDIT", 10)]), { jobId: "JOB_AUD", skills: siti, scenario: "moderate" });
  assert.deepEqual(r.stop_investing_by_year[2028], []);
  assert.deepEqual(r.stop_investing_by_year[2030].map((s) => s.skill_id), ["S_DATA"]);
  // By 2032 S_COMM is a trap too, but the auditor needs it, so it isn't listed.
  assert.equal(skillLabel(old, skillTimeline(old), "S_COMM", 2032), "trap");
  assert.deepEqual(r.stop_investing_by_year[2032].map((s) => s.skill_id), ["S_DATA"]);
});

test("an unknown role is an error", () => {
  assert.throws(() => routeFor(withCourses([]), { jobId: "JOB_NOPE" }), /Unknown role/);
});
