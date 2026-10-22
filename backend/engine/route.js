// The learning route to one target role: the skills the person is missing, in a sensible order,
// each with a real course from courses.csv. Courses are never made up: a skill with no course says so.
import { splitSourceIds } from "./load.js";
import { groupsOf, skillCredit, taskSkillsFor } from "./match.js";
import { skillTimeline, skillLabel } from "./skills.js";
import { forecastScenario } from "./forecast.js";

// Part-time study pace used to turn hours into weeks. Our assumption, shown in the receipt.
export const HOURS_PER_WEEK = 3.5;

// skills = the skill ids the person lists themselves; tasks = their week. The skills of their tasks are added
// here, so a task removed on the You page also stops counting on the Route page.
// With a scenario, steps are ordered by how long the skill stays human, and get robust / bet / trap labels.
export function routeFor(snap, { jobId, skills = [], tasks = [], scenario = null }) {
  const role = snap.roles.get(jobId);
  if (!role) throw new Error(`Unknown role "${jobId}"`);
  if (!snap.courses.length) {
    return { status: "not_ready", role_id: jobId, message: "No course list (courses.csv) in this snapshot" };
  }

  const skillsOf = taskSkillsFor(snap, tasks);
  const have = new Set([...skills, ...tasks.flatMap((t) => skillsOf(t.task_id))].filter((s) => snap.skills.has(s)));
  const haveGroups = groupsOf(snap, have);
  const missing = role.skill_ids.filter((s) => !have.has(s));
  // Skills close to one the person has come first: they build on what they know, so they're quicker wins.
  const isRelated = (s) => skillCredit(snap, s, have, haveGroups) > 0;
  let ordered = [...missing.filter(isRelated), ...missing.filter((s) => !isRelated(s))];
  // With a scenario: skills that stay human longest come first (the spec's "robust first, bets after"),
  // skills with no published task time last. Related skills still come first among equals.
  const timeline = scenario ? skillTimeline(snap) : null;
  const years = scenario ? forecastScenario(snap, [], scenario).years : [];
  if (timeline) {
    const until = (s) => timeline.get(s)?.until[scenario] ?? -Infinity;
    ordered = ordered.map((s, i) => ({ s, i })).sort((a, b) => until(b.s) - until(a.s) || a.i - b.i).map((x) => x.s);
  }
  const labelsByYear = (s) => Object.fromEntries(years.map((y) => [y, skillLabel(snap, timeline, s, y)]));

  const steps = [];
  const noCourse = [];
  for (const skillId of ordered) {
    const course = snap.courses.find((c) => c.skill_id === skillId);
    if (!course) {
      noCourse.push(skillId);
      continue;
    }
    steps.push({ order: steps.length + 1, skill_id: skillId, related: isRelated(skillId), course,
      label_by_year: timeline ? labelsByYear(skillId) : null });
  }

  // Courses with no stated hours are left out of the total and counted separately, never guessed.
  const knownHours = steps.map((s) => s.course.hours).filter((h) => h !== null && Number.isFinite(h));
  const totalHours = Math.round(knownHours.reduce((sum, h) => sum + h, 0) * 10) / 10;

  return {
    status: "ready",
    snapshot_date: snap.date,
    role_id: role.role_id,
    role_name: role.role_name,
    steps,
    no_course_skill_ids: noCourse,
    // Per year: skills the person has that are a trap that year and that this role doesn't need.
    stop_investing_by_year: timeline ? Object.fromEntries(years.map((y) => [y,
      [...have].filter((s) => !role.skill_ids.includes(s) && skillLabel(snap, timeline, s, y) === "trap")
        .map((s) => ({ skill_id: s, sources: splitSourceIds([...timeline.get(s).sources]) }))])) : null,
    total_hours: totalHours,
    courses_without_hours: steps.length - knownHours.length,
    hours_per_week: HOURS_PER_WEEK,
    total_weeks: Math.ceil(totalHours / HOURS_PER_WEEK),
    sources: splitSourceIds([role.source, ...steps.map((s) => s.course.source),
      ...steps.flatMap((s) => [...(timeline?.get(s.skill_id)?.sources ?? [])])]),
    // The order and the weeks are our estimate; the courses themselves are real listings.
    is_estimate: true,
  };
}
