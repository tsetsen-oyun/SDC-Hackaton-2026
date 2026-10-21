// Skill weather cards and robust / bet / trap labels.
// The label belongs to the skill: it comes from every task in our data that uses it, so the same skill
// gets the same label on every page. The weather comes from the person's own week.
import { buildContext, forecastTask, forecastScenario } from "./forecast.js";
import { splitSourceIds } from "./load.js";

// For each skill, per scenario: the year AI could do the last dated task in our data that uses it.
// Tasks with no published time are left out: counting them would make a skill look safe only because data is missing.
export function skillTimeline(snap, assumptions = {}) {
  const ctx = buildContext(snap, assumptions);
  const timeline = new Map();
  for (const task of snap.tasks.values()) {
    for (const scenario of snap.scenarios.values()) {
      const r = forecastTask(task, scenario, ctx);
      if (r.status !== "dated") continue;
      for (const s of snap.taskSkills.get(task.task_id) ?? []) {
        if (!timeline.has(s)) timeline.set(s, { until: {}, sources: new Set() });
        const entry = timeline.get(s);
        entry.until[scenario.scenario_id] = Math.max(entry.until[scenario.scenario_id] ?? -Infinity, r.mid);
        for (const id of r.sources) entry.sources.add(id);
      }
    }
  }
  return timeline;
}

// After `year`: robust = some task using the skill is still human in every scenario; bet = only in some
// (in practice: only if AI slows down); trap = in none. null when no task using it has a published time.
export function skillLabel(snap, timeline, skillId, year) {
  const entry = timeline.get(skillId);
  if (!entry) return null;
  const ids = [...snap.scenarios.keys()];
  const stillHuman = ids.filter((id) => entry.until[id] > year).length;
  return stillHuman === ids.length ? "robust" : stillHuman === 0 ? "trap" : "bet";
}

// The Forecast page's skill cards, for every year, under one scenario.
// Weather: is the skill a bigger (☀️ rising), smaller (🌧️ declining) or the same (⛅ steady) part of the
// still-human hours of the week than today? A person with no work week gets the skills of the tasks shown
// (their target job), each task counting the same.
export function skillCards(snap, personTasks, scenarioId, assumptions = {}) {
  const hasWeek = personTasks.some((t) => t.hours > 0);
  const tasks = hasWeek ? personTasks.filter((t) => t.hours > 0) : personTasks.map((t) => ({ ...t, hours: 1 }));
  const forecast = forecastScenario(snap, tasks, scenarioId, assumptions);
  const timeline = skillTimeline(snap, assumptions);
  const dated = new Map(forecast.tasks.filter((t) => t.status === "dated").map((t) => [t.task_id, t.mid]));
  const skillIds = [...new Set(tasks.flatMap((t) => snap.taskSkills.get(t.task_id) ?? []))];

  // Each skill's share of the dated hours that are still human in `year`.
  const shares = (year) => {
    const human = tasks.filter((t) => dated.has(t.task_id) && dated.get(t.task_id) > year);
    const total = human.reduce((sum, t) => sum + t.hours, 0);
    const out = new Map();
    for (const t of human) for (const s of snap.taskSkills.get(t.task_id) ?? []) out.set(s, (out.get(s) ?? 0) + t.hours);
    return new Map(skillIds.map((s) => [s, total ? (out.get(s) ?? 0) / total : 0]));
  };
  // Today: the whole week as the person does it now, before AI could do any of it.
  const now = shares(-Infinity);

  const by_year = {};
  for (const year of forecast.years) {
    const later = shares(year);
    const cards = skillIds.map((s) => {
      const entry = timeline.get(s);
      return {
        skill_id: s,
        label: skillLabel(snap, timeline, s, year),
        // null when none of this person's tasks using the skill has a published time.
        weather: !now.get(s) ? null : weatherOf(now.get(s), later.get(s)),
        hours: tasks.filter((t) => (snap.taskSkills.get(t.task_id) ?? []).includes(s)).reduce((sum, t) => sum + t.hours, 0),
        human_until: entry ? Object.fromEntries(Object.entries(entry.until).map(([id, y]) => [id, Math.round(y * 10) / 10])) : null,
        sources: entry ? splitSourceIds([...entry.sources]) : [],
        is_estimate: true,
      };
    });
    cards.sort((a, b) => rank(a.label) - rank(b.label) || b.hours - a.hours || a.skill_id.localeCompare(b.skill_id));
    by_year[year] = cards;
  }
  return { snapshot_date: snap.date, scenario: scenarioId, skills_from: hasWeek ? "week" : "tasks_shown", years: forecast.years, by_year };
}

// Compared on whole percentage points, so tiny rounding differences don't count as a change.
function weatherOf(before, after) {
  const a = Math.round(before * 100);
  const b = Math.round(after * 100);
  return b > a ? "rising" : b < a ? "declining" : "steady";
}

const ORDER = { robust: 0, bet: 1, trap: 2 };
function rank(label) {
  return ORDER[label] ?? 3;
}
