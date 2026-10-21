// The learning route to one target role: the skills the person is missing, in a sensible order,
// each with a real course from courses.csv. Courses are never made up: a skill with no course says so.
import { splitSourceIds } from "./load.js";
import { groupsOf, skillCredit } from "./match.js";

// Part-time study pace used to turn hours into weeks. Our assumption, shown in the receipt.
export const HOURS_PER_WEEK = 3.5;

// skills = the skill ids the person already has (from their tasks or their own list).
export function routeFor(snap, { jobId, skills = [] }) {
  const role = snap.roles.get(jobId);
  if (!role) throw new Error(`Unknown role "${jobId}"`);
  if (!snap.courses.length) {
    return { status: "not_ready", role_id: jobId, message: "No course list (courses.csv) in this snapshot" };
  }

  const have = new Set(skills.filter((s) => snap.skills.has(s)));
  const haveGroups = groupsOf(snap, have);
  const missing = role.skill_ids.filter((s) => !have.has(s));
  // Skills close to one the person has come first: they build on what they know, so they're quicker wins.
  const isRelated = (s) => skillCredit(snap, s, have, haveGroups) > 0;
  const ordered = [...missing.filter(isRelated), ...missing.filter((s) => !isRelated(s))];

  const steps = [];
  const noCourse = [];
  for (const skillId of ordered) {
    const course = snap.courses.find((c) => c.skill_id === skillId);
    if (!course) {
      noCourse.push(skillId);
      continue;
    }
    steps.push({ order: steps.length + 1, skill_id: skillId, related: isRelated(skillId), course });
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
    total_hours: totalHours,
    courses_without_hours: steps.length - knownHours.length,
    hours_per_week: HOURS_PER_WEEK,
    total_weeks: Math.ceil(totalHours / HOURS_PER_WEEK),
    sources: splitSourceIds([role.source, ...steps.map((s) => s.course.source)]),
    // The order and the weeks are our estimate; the courses themselves are real listings.
    is_estimate: true,
  };
}
