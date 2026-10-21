// Which real roles fit this person next, and what skills are they missing?
// The forecast feeds this: as AI could do more of their tasks, their leftover skills change,
// and so do the roles that fit those skills and the roles' own outlook.
import { buildContext, forecastTask, forecastScenario } from "./forecast.js";
import { splitSourceIds } from "./load.js";

// Our weighting, shown in the receipt. The three parts are each between 0 and 1.
export const WEIGHTS = { skills: 0.4, leftover: 0.3, outlook: 0.3 };
// marketPlanet ranking: points added (+) or taken away (−) per SDG link of a role. Also our weighting.
export const SDG_POINTS = 10;
// A skill that isn't an exact match but shares an ESCO group with one on the other side counts this much.
// Also our weighting. ESCO job skill lists are very specific, so exact matches alone are almost always 0.
export const RELATED_CREDIT = 0.5;

export function matchScenario(snap, { tasks: personTasks, skills: extraSkills = [], scenario, mode = "market" }, assumptions = {}) {
  const forecast = forecastScenario(snap, personTasks, scenario, assumptions);
  const ctx = buildContext(snap, assumptions);
  const scenarioRow = snap.scenarios.get(scenario);

  const ownJobs = new Set(personTasks.map((t) => snap.tasks.get(t.task_id)?.job).filter(Boolean));
  const personSkills = new Set(personTasks.flatMap((t) => snap.taskSkills.get(t.task_id) ?? []));
  // Skills the person adds themselves count only if they are real skills from our list.
  for (const s of extraSkills) if (!snap.skills.size || snap.skills.has(s)) personSkills.add(s);
  const personGroups = groupsOf(snap, personSkills);

  // Roles to move to: not the person's own job, and not a row marked as a "current" job.
  const candidates = [...snap.roles.values()].filter((r) => !ownJobs.has(r.role_id) && r.kind !== "current");
  // Each role's own tasks, dated once per scenario, for its outlook.
  const roleTaskResults = new Map(candidates.map((r) => [r.role_id, roleTasks(snap, r).map((t) => forecastTask(t, scenarioRow, ctx))]));

  const planetMode = mode === "marketPlanet";
  const sdgByRole = groupSdgLinks(snap.sdgLinks);
  const note = planetMode && !snap.sdgLinks.length ? "No SDG links in this snapshot yet, so the ranking is the same as market" : null;

  const by_year = {};
  for (const year of forecast.years) {
    const week = forecast.by_year[year];
    const leftoverSkills = new Set(week.leftover_task_ids.flatMap((id) => snap.taskSkills.get(id) ?? []));

    const roles = candidates.map((role) => {
      const need = role.skill_ids;
      const have = need.filter((s) => personSkills.has(s));
      const related = need.filter((s) => !personSkills.has(s) && skillCredit(snap, s, personSkills, personGroups) > 0);
      const parts = {
        // How much of the role's skill list the person already has (exact = 1, related = RELATED_CREDIT).
        skills: need.length ? (have.length + RELATED_CREDIT * related.length) / need.length : 0,
        // How much of what's still human in their week this role uses.
        // A person with no work week (no current job) has nothing to measure here, so it's left out.
        leftover: !week.hours_total ? null : leftoverFit(snap, role, leftoverSkills),
        // Share of the role's own dated tasks that AI could not do yet in this year and scenario.
        outlook: outlookShare(roleTaskResults.get(role.role_id), year),
      };
      // reviewed is empty until a person checks the link, so the page can say "not yet checked".
      const sdg = (sdgByRole.get(role.role_id) ?? []).map((l) => ({
        target: l.sdg_target, sign: l.sign, reason: l.one_line_reason ?? null, source: l.source,
        is_estimate: l.is_estimate ?? null, reviewed: l.reviewed ?? null,
      }));
      const sdgPoints = planetMode ? sdg.reduce((sum, l) => sum + (l.sign === "+" ? SDG_POINTS : -SDG_POINTS), 0) : 0;

      return {
        role_id: role.role_id,
        name: role.role_name,
        closest_real_occupation: role.closest_real_occupation ?? null,
        codes: { onet: role.onet_code ?? null, esco: role.esco_uri ?? null, isco: role.isco_code ?? null },
        score: Math.round(weightedScore(parts) + sdgPoints),
        parts: toPoints(parts, sdgPoints),
        // false when the person has none of the role's skills, not even a related one.
        shares_skills: have.length + related.length > 0,
        have: have.length,
        related: related.length,
        need: need.length,
        have_skill_ids: have,
        // Missing skills that share an ESCO group with one the person has: likely easier to learn.
        related_skill_ids: related,
        missing_skill_ids: need.filter((s) => !personSkills.has(s)),
        sdg,
        sources: splitSourceIds([role.source, ctx.frontier.source, scenarioRow.source, ...sdg.map((l) => l.source)]),
        // The score depends on a forecast, so it is always an estimate.
        is_estimate: true,
      };
    });
    // A role the person shares no skills with comes after every role they do, whatever its outlook:
    // a good outlook alone doesn't make a role fit this person.
    roles.sort((a, b) => b.shares_skills - a.shares_skills || b.score - a.score || a.role_id.localeCompare(b.role_id));

    by_year[year] = { emerging_role: emergingRole(snap, ownJobs, leftoverSkills, week), roles };
  }

  return {
    snapshot_date: snap.date,
    scenario: forecast.scenario,
    mode,
    note,
    weights: { ...WEIGHTS, related_skill_credit: RELATED_CREDIT, sdg_points_per_link: planetMode ? SDG_POINTS : 0, label: "our weighting" },
    skill_links: skillLinksNote(snap),
    person_skill_ids: [...personSkills],
    years: forecast.years,
    by_year,
  };
}

// What the receipt says about where the person's skills come from.
function skillLinksNote(snap) {
  if (snap.skillLinks === "job") {
    return { level: "job", note: "Skills are linked per job (ESCO), so the leftover skills don't change with the year", is_estimate: false };
  }
  const who = snap.taskLinksAreEstimates ? "an AI model" : "our team";
  const rest = snap.tasksWithOwnLinks < snap.tasks.size ? ". Other tasks use their job's whole ESCO list" : "";
  return { level: "task", note: `Each task's skills were picked by ${who} from its job's ESCO list${rest}`, is_estimate: snap.taskLinksAreEstimates };
}

// A role's tasks: the ids listed in roles.csv, or else every task whose job is this role.
export function roleTasks(snap, role) {
  const ids = role.task_ids?.length ? role.task_ids : [...snap.tasks.values()].filter((t) => t.job === role.role_id).map((t) => t.task_id);
  return ids.map((id) => snap.tasks.get(id)).filter(Boolean);
}

// The ESCO groups of a list of skills. A skill can be in several groups; a skill with no group adds none.
function groupsOf(snap, skillIds) {
  return new Set([...skillIds].flatMap((id) => snap.skills.get(id)?.group_uri ?? []));
}

// How much one skill counts against a set of skills: 1 if it's in the set,
// RELATED_CREDIT if it shares an ESCO group with any of them, otherwise 0.
function skillCredit(snap, skillId, skillSet, groupSet) {
  if (skillSet.has(skillId)) return 1;
  const groups = snap.skills.get(skillId)?.group_uri ?? [];
  return groups.some((g) => groupSet.has(g)) ? RELATED_CREDIT : 0;
}

// Share of the person's leftover skills that this role uses (exact = 1, related = RELATED_CREDIT).
// Leftover skills change as AI could do more of their tasks, so this is where the trend feeds the match.
function leftoverFit(snap, role, leftoverSkills) {
  if (!leftoverSkills.size) return 0;
  const roleSkills = new Set(role.skill_ids);
  const roleGroups = groupsOf(snap, roleSkills);
  let total = 0;
  for (const s of leftoverSkills) total += skillCredit(snap, s, roleSkills, roleGroups);
  return total / leftoverSkills.size;
}

// null when none of the role's tasks has a published time: we can't say anything about its outlook.
function outlookShare(results, year) {
  const dated = results.filter((r) => r.status === "dated");
  if (!dated.length) return null;
  return dated.filter((r) => r.mid > year).length / dated.length;
}

// A part we can't measure (null) is left out, and the other weights are scaled up to fill its place,
// so a role isn't pushed down just because data is missing.
function weightedScore(parts) {
  let total = 0;
  let weight = 0;
  for (const [key, w] of Object.entries(WEIGHTS)) {
    if (parts[key] === null) continue;
    total += w * parts[key];
    weight += w;
  }
  return weight ? (100 * total) / weight : 0;
}

// The receipt shows each part in points, adding up to the score.
function toPoints(parts, sdgPoints) {
  const known = Object.entries(WEIGHTS).filter(([key]) => parts[key] !== null);
  const weight = known.reduce((sum, [, w]) => sum + w, 0);
  const points = {};
  for (const [key, w] of Object.entries(WEIGHTS)) {
    points[key] = parts[key] === null ? null : Math.round((100 * w * parts[key]) / weight);
  }
  if (sdgPoints) points.sdg = sdgPoints;
  return points;
}

// The real role whose skills look most like what's left of the person's week.
// It is never a new, invented job: only rows from roles.csv, labelled as an estimate.
// Nothing has been unbundled while AI could do none of their hours, so there's no emerging role yet.
// Only target roles count: the page calls it "a new role forming", and another person's current job isn't one.
function emergingRole(snap, ownJobs, leftoverSkills, week) {
  if (week.hours_ai === 0 || !leftoverSkills.size) return null;
  let best = null;
  for (const role of snap.roles.values()) {
    if (ownJobs.has(role.role_id) || role.kind === "current") continue;
    // Same measure as the score's leftover part, so the two never disagree about what "fits" means.
    const overlap = leftoverFit(snap, role, leftoverSkills);
    if (overlap > 0 && (!best || overlap > best.overlap)) best = { role, overlap };
  }
  if (!best) return null;
  return {
    role_id: best.role.role_id,
    name: best.role.role_name,
    closest_real_occupation: best.role.closest_real_occupation ?? null,
    overlap: Math.round(best.overlap * 100) / 100,
    note: "Your leftover tasks look most like this real job",
    sources: splitSourceIds([best.role.source]),
    is_estimate: true,
  };
}

function groupSdgLinks(links) {
  const map = new Map();
  for (const l of links.filter((l) => l.item_type === "role")) {
    if (!map.has(l.item_id)) map.set(l.item_id, []);
    map.get(l.item_id).push(l);
  }
  return map;
}
