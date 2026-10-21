// Junior–senior mentor pairs: what each person could teach the other, from skills only.
// Senior = has a work week (tasks with hours); junior = has none. Name and age are never read here,
// so they can't change who is paired or what each side brings.
import { forecastScenario } from "./forecast.js";
import { matchScenario, groupsOf, skillCredit, taskSkillsFor } from "./match.js";
import { splitSourceIds } from "./load.js";

export const CONSENT_NOTE = "A possible pair only: both people must say yes, and a person approves the match. Age is not used.";

// person = { tasks: [{ task_id, hours }], skills: [skill ids], userId (optional, so a sample person isn't paired with themselves) }.
// Returns every sample person in users.csv on the other side, with what each brings, for every year.
export function mentorPairs(snap, { tasks = [], skills = [], userId = null, scenario }) {
  const person = sideOf(snap, { tasks, skills });
  const others = [...snap.users.values()]
    .filter((u) => u.user_id !== userId)
    .map((u) => ({ user_id: u.user_id, ...sideOf(snap, { tasks: u.tasks, skills: u.skill_ids ?? [] }) }))
    .filter((o) => o.side !== person.side);

  const pairs = others.map((other) => {
    const [senior, junior] = person.side === "senior" ? [person, other] : [other, person];
    const forecast = forecastScenario(snap, senior.tasks, scenario);
    const seniorMatch = matchScenario(snap, { tasks: senior.tasks, skills: [...senior.skills], scenario });
    // Tasks that stay human longest first; tasks with no published time last (we can't date them).
    const latest = new Map(forecast.tasks.map((t) => [t.task_id, t.status === "dated" ? t.mid : -Infinity]));

    const by_year = {};
    for (const year of forecast.years) {
      const leftover = [...forecast.by_year[year].leftover_task_ids].sort((a, b) => latest.get(b) - latest.get(a));
      // The senior brings skills from tasks AI could not do yet this year, which the junior doesn't have.
      const seniorBrings = unique(leftover.flatMap(senior.skillsOf)).filter((s) => !junior.skills.has(s));
      // The junior brings skills the senior doesn't have. The ones the senior's best next role needs come first,
      // then ones related to it (same ESCO group, the same rule as matching), then the rest.
      const topRole = snap.roles.get(seniorMatch.by_year[year].roles[0]?.role_id);
      const needed = new Set(topRole?.skill_ids ?? []);
      const neededGroups = groupsOf(snap, needed);
      const credit = (s) => skillCredit(snap, s, needed, neededGroups);
      const juniorOnly = [...junior.skills].filter((s) => !senior.skills.has(s));
      const juniorBrings = [...juniorOnly].sort((a, b) => credit(b) - credit(a));
      by_year[year] = {
        senior_brings: seniorBrings,
        junior_brings: juniorBrings,
        senior_top_role: topRole?.role_id ?? null,
        // Only a pair when both sides have something to teach.
        possible: seniorBrings.length > 0 && juniorBrings.length > 0,
      };
    }

    return {
      user_id: other.user_id,
      person_side: person.side,
      by_year,
      // The task forecasts, and the job rows the senior's task skills come from (ESCO via roles.csv).
      sources: splitSourceIds([
        ...forecast.tasks.flatMap((t) => t.sources),
        ...senior.tasks.map((t) => snap.roles.get(snap.tasks.get(t.task_id)?.job)?.source),
      ]),
      // It depends on a forecast, so it is an estimate.
      is_estimate: true,
    };
  });

  return { snapshot_date: snap.date, scenario, consent_note: CONSENT_NOTE, pairs };
}

// Which side a person is on, and all their skills (their own list plus the skills of the tasks they do).
function sideOf(snap, { tasks, skills }) {
  const worked = tasks.filter((t) => t.hours > 0);
  const skillsOf = taskSkillsFor(snap, worked);
  const all = new Set([...skills, ...worked.flatMap((t) => skillsOf(t.task_id))].filter((s) => snap.skills.has(s)));
  return { side: worked.length ? "senior" : "junior", tasks: worked, skills: all, skillsOf };
}

function unique(list) {
  return [...new Set(list)];
}
