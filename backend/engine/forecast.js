// When could AI do each task? One date range per task, per scenario.
// Fixed rules only: the same snapshot and inputs always give the same answer.

import { splitSourceIds } from "./load.js";

const DAYS_PER_YEAR = 365.25;
const NO_DATA_REASON = "No published time for this task (not in Anthropic's usage data)";

// "2026-07-02" -> 2026.4986. Dates are decimal years so the maths stays simple; the page rounds them.
export function toDecimalYear(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dayOfYear = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return y + dayOfYear / (leap ? 366 : 365);
}

// Everything the formula needs that doesn't depend on the task.
export function buildContext(snap, assumptions = {}) {
  // Start from the longest task the newest models can do at 80% reliability.
  const measured = snap.aiProgress.filter((r) => r.horizon_80pct_min !== null);
  if (!measured.length) throw new Error("ai_progress.csv has no horizon_80pct_min values");
  const frontier = measured.reduce((best, r) => (r.horizon_80pct_min > best.horizon_80pct_min ? r : best));

  // METR measured software tasks; office work is harder for AI by this factor (our labelled assumption).
  // A task of m minutes counts as m x D minutes of METR-style work, which equals dividing the horizon by D.
  const officeWork = assumptions.officeWork !== false;
  const D = officeWork ? snap.params.domain_discount ?? 1 : 1;

  return {
    snap,
    t0: toDecimalYear(frontier.release_date),
    h0: frontier.horizon_80pct_min,
    frontier,
    officeWork,
    D,
    // No published source for an adoption delay, so null means none: dates mean "AI could do it".
    adoption: snap.params.adoption_delay_years ?? 0,
  };
}

// The year AI's horizon reaches a task of `minutes`, in one scenario.
export function crossoverYear(minutes, scenario, ctx) {
  const length = minutes * ctx.D;
  const year = scenario.doubling_days !== null
    ? steadyYear(length, scenario.doubling_days, ctx)
    : slowdownYear(length, ctx);
  return year + ctx.adoption;
}

// Steady growth: one doubling every `doubling_days`.
// A task already within the horizon gets 0 doublings, so its year is t0.
function steadyYear(length, doublingDays, ctx) {
  const doublings = Math.max(0, Math.log2(length / ctx.h0));
  return ctx.t0 + doublings * (doublingDays / DAYS_PER_YEAR);
}

// The slowdown has no single doubling time; it publishes delays at a few task lengths.
// We draw its growth curve through: today's measured horizon (no delay yet), then each milestone
// at (moderate-pace date for that length + its delay). Between points the curve is a straight line on a
// log scale, the same assumption the steady scenarios make. Past the last milestone it goes on at moderate pace.
function slowdownYear(length, ctx) {
  const moderate = ctx.snap.scenarios.get("moderate");
  if (!moderate) throw new Error("The slowdown scenario needs a 'moderate' scenario to measure its delays from");
  if (!ctx.snap.milestones.length) throw new Error("The slowdown scenario needs slowdown_milestones.csv");

  const points = [{ x: Math.log2(ctx.h0), year: ctx.t0 }];
  for (const m of ctx.snap.milestones) {
    // Milestone lengths are already METR-style minutes, so no office-work factor here.
    const x = Math.log2(m.task_length_minutes);
    if (x <= points[points.length - 1].x) continue;
    points.push({ x, year: steadyYear(m.task_length_minutes, moderate.doubling_days, ctx) + m.delay_years_under_slowdown });
  }

  const x = Math.log2(length);
  if (x <= points[0].x) return points[0].year;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) return a.year + ((x - a.x) / (b.x - a.x)) * (b.year - a.year);
  }
  const last = points[points.length - 1];
  return last.year + (x - last.x) * (moderate.doubling_days / DAYS_PER_YEAR);
}

// One task's date range in one scenario, with the sources its receipt shows.
export function forecastTask(task, scenario, ctx) {
  const low = task.minutes_low ?? task.minutes_median;
  const high = task.minutes_high ?? task.minutes_median;
  if (low === null || high === null) {
    return {
      task_id: task.task_id,
      name: task.task_description,
      status: "no_data",
      reason: NO_DATA_REASON,
      sources: splitSourceIds([task.source]),
      is_estimate: false,
    };
  }
  const from = crossoverYear(low, scenario, ctx);
  const to = crossoverYear(high, scenario, ctx);
  return {
    task_id: task.task_id,
    name: task.task_description,
    status: "dated",
    from: round(from),
    to: round(to),
    mid: round((from + to) / 2),
    mode: task.automate_or_augment ?? null,
    used_with_ai_today: task.aei_usage_share ?? null,
    sources: splitSourceIds([
      ctx.frontier.source,
      task.minutes_source,
      scenario.source,
      ctx.D > 1 ? ctx.snap.params.domain_discount_source : null,
      task.source,
    ]),
    // A forecast is always an estimate, whatever its inputs.
    is_estimate: true,
  };
}

// The person's week, year by year: how many of their hours AI could do.
// A task counts from the first year that reaches the middle of its range.
// A task with no data never counts, and its hours are shown separately.
export function weekByYear(personTasks, taskResults, years) {
  const resultById = new Map(taskResults.map((r) => [r.task_id, r]));
  const hoursTotal = personTasks.reduce((sum, t) => sum + t.hours, 0);
  const out = {};
  for (const year of years) {
    let hoursAi = 0;
    let hoursNoData = 0;
    const leftover = [];
    for (const { task_id, hours } of personTasks) {
      const r = resultById.get(task_id);
      if (r?.status === "dated" && r.mid <= year) hoursAi += hours;
      else {
        if (r?.status !== "dated") hoursNoData += hours;
        leftover.push(task_id);
      }
    }
    out[year] = {
      hours_ai: hoursAi,
      hours_no_data: hoursNoData,
      hours_total: hoursTotal,
      // No hours (a person with no current job) means no week to measure, not 0%.
      share_ai: hoursTotal ? round(hoursAi / hoursTotal, 3) : null,
      leftover_task_ids: leftover,
      is_estimate: true,
    };
  }
  return out;
}

// Everything the Forecast page needs for one person in one scenario, for every year at once.
export function forecastScenario(snap, personTasks, scenarioId, assumptions = {}) {
  const scenario = snap.scenarios.get(scenarioId);
  if (!scenario) throw new Error(`Unknown scenario "${scenarioId}"`);
  const ctx = buildContext(snap, assumptions);

  const tasks = personTasks.map(({ task_id, hours }) => {
    const task = snap.tasks.get(task_id);
    if (!task) return { task_id, hours, status: "unknown_task", sources: [], is_estimate: false };
    return { ...forecastTask(task, scenario, ctx), hours };
  });

  const startYear = Math.floor(toDecimalYear(snap.params.reference_date));
  const years = Array.from({ length: 10 }, (_, i) => startYear + i);

  return {
    snapshot_date: snap.date,
    scenario: {
      id: scenario.scenario_id,
      name: scenario.name,
      doubling_days: scenario.doubling_days,
      note: scenario.assumption_note ?? null,
      sources: splitSourceIds([scenario.source]),
      is_estimate: true,
    },
    start: { model: ctx.frontier.model, release_date: ctx.frontier.release_date, horizon_80pct_min: ctx.h0 },
    assumptions: { office_work: ctx.officeWork, domain_discount: ctx.D, adoption_delay_years: ctx.adoption },
    years,
    tasks,
    by_year: weekByYear(personTasks, tasks, years),
  };
}

function round(n, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
