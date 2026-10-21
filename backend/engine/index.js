// The engine's front door: the functions Oyuka's server.js calls.
// It keeps one snapshot loaded in memory; Refresh swaps it for the newest one.
// Inputs are task ids and hours only. Name and age never come in, so they can't affect any result.
import { listSnapshots, loadSnapshot, snapshotsDir } from "./load.js";
import { forecastScenario } from "./forecast.js";
import { matchScenario, roleTasks } from "./match.js";
import { routeFor } from "./route.js";

let current = null;

// Which snapshot the app starts with. For the Refresh demo, set START_SNAPSHOT to the older date;
// Refresh then moves to the newest one. Without it, the app starts on the newest.
// Exported so pages.js can look up names and sources in the same snapshot.
export function snapshot() {
  if (!current) {
    const dates = listSnapshots();
    if (!dates.length) throw new Error(`No snapshot folders in ${snapshotsDir()}`);
    const start = process.env.START_SNAPSHOT;
    current = loadSnapshot(start && dates.includes(start) ? start : dates[dates.length - 1]);
  }
  return current;
}

// Load one snapshot by date (for the demo, tests and a later backtest).
export function useSnapshot(date) {
  current = loadSnapshot(date);
  return current.date;
}

// tasks = [{ task_id, hours }], scenario = "moderate" | "fast" | "slowdown".
// Returns that scenario's date range per task and the week for every year, so the slider never waits.
export function forecast(tasks, scenario, assumptions = {}) {
  return forecastScenario(snapshot(), cleanTasks(tasks), scenario, assumptions);
}

// skills = extra skill ids the person says they have (can be empty). mode = "market" | "marketPlanet".
// Returns the ranked roles for every year.
export function match({ tasks, skills = [], scenario, mode = "market", assumptions = {} }) {
  return matchScenario(snapshot(), { tasks: cleanTasks(tasks), skills, scenario, mode }, assumptions);
}

// The missing skills for one role, in order, each with a real course. skills = the person's skill ids.
// Without courses.csv it says so instead of guessing courses.
export function buildRoute({ jobId, skills = [] } = {}) {
  return routeFor(snapshot(), { jobId, skills });
}

// Everything the About page and the receipts need.
export function getSources() {
  const snap = snapshot();
  return {
    snapshot_date: snap.date,
    llm_model_used: snap.manifest.llm_model_used ?? null,
    sources: [...snap.sources.values()],
    scenarios: [...snap.scenarios.values()].map((s) => ({
      id: s.scenario_id,
      name: s.name,
      doubling_days: s.doubling_days,
      note: s.assumption_note ?? null,
      source: s.source,
    })),
    params: snap.params,
    missing_files: snap.missing,
    warnings: snap.warnings,
  };
}

// The sample people. Name and age are for display only.
export function getProfiles() {
  const snap = snapshot();
  return [...snap.users.values()].map((u) => ({
    user_id: u.user_id,
    display_name: u.display_name,
    display_age: u.display_age ?? null,
    current_job: u.current_job,
    current_job_name: snap.roles.get(u.current_job)?.role_name ?? null,
    tasks: u.tasks.map((t) => ({ ...t, name: snap.tasks.get(t.task_id)?.task_description ?? null })),
    target_job: u.target_job ?? null,
    target_job_name: snap.roles.get(u.target_job)?.role_name ?? null,
    // Skills of a person with no work history (send them to match as skills). Sample data, never scored on name or age.
    skill_ids: u.skill_ids ?? [],
    target_job_tasks: targetJobTasks(snap, u),
  }));
}

// A person with no current job has no week to forecast, so the Forecast page shows the target job's tasks instead.
// Hours are 0: we don't make up a week for them, and the engine then returns share_ai = null.
function targetJobTasks(snap, user) {
  const role = snap.roles.get(user.target_job);
  if (user.current_job || !role) return [];
  return roleTasks(snap, role).map((t) => ({ task_id: t.task_id, hours: 0, name: t.task_description }));
}

// Switch to the newest snapshot. If that fails, keep the current one and say so,
// so the app never ends up with no data on stage.
// It's async so a live data fetch can be added later without changing the server.
export async function refreshData() {
  const previous = current?.date ?? null;
  try {
    const dates = listSnapshots();
    if (!dates.length) throw new Error(`No snapshot folders in ${snapshotsDir()}`);
    const newest = dates[dates.length - 1];
    if (newest !== previous) current = loadSnapshot(newest);
    return {
      snapshot_date: current.date,
      previous,
      changed: current.date !== previous,
      fallback: false,
      missing_files: current.missing,
      warnings: current.warnings,
    };
  } catch (err) {
    return { snapshot_date: previous, previous, changed: false, fallback: true, error: err.message };
  }
}

// Accepts the shape the pages send and keeps only what the engine needs.
function cleanTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error("tasks must be a list of { task_id, hours }");
  return tasks.map((t) => ({ task_id: String(t.task_id), hours: Number(t.hours) || 0 }));
}
