// The engine's front door: the functions Oyuka's server.js calls.
// It keeps one snapshot loaded in memory; Refresh swaps it for the newest one.
// Inputs are task ids and hours only. Name and age never come in, so they can't affect any result.
import { listSnapshots, loadSnapshot, snapshotsDir } from "./load.js";
import { forecastScenario } from "./forecast.js";
import { matchScenario, roleTasks } from "./match.js";
import { routeFor } from "./route.js";
import { mentorPairs } from "./mentor.js";
import { skillCards } from "./skills.js";
import { METR_URL, fetchText, parseMetr, validateMetr, sameTrend, describeChange, writeLiveSnapshot } from "./ingest.js";

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
// Returns the ranked roles for every year. targetJob (optional) = the job a person with no work week aims for;
// it is shown on the Map even if roles.csv marks it as a current job.
export function match({ tasks, skills = [], scenario, mode = "market", targetJob = null, assumptions = {} }) {
  return matchScenario(snapshot(), { tasks: cleanTasks(tasks), skills, scenario, mode, targetJob }, assumptions);
}

// The missing skills for one role, in order, each with a real course. skills = the person's own skill ids,
// tasks = their week (its skills are added). Without courses.csv it says so instead of guessing courses.
// With a scenario, steps get robust / bet / trap labels.
export function buildRoute({ jobId, skills = [], tasks = [], scenario = null } = {}) {
  return routeFor(snapshot(), { jobId, skills, tasks: cleanTasks(tasks), scenario });
}

// The Forecast page's skill weather cards with robust / bet / trap labels, for every year.
export function skillWeather(tasks, scenario, assumptions = {}) {
  return skillCards(snapshot(), cleanTasks(tasks), scenario, assumptions);
}

// Possible junior–senior pairs with the sample people, from skills only. userId keeps a sample person
// from being paired with themselves. Returns every year, like match.
export function mentor({ tasks = [], skills = [], scenario, userId = null } = {}) {
  return mentorPairs(snapshot(), { tasks: cleanTasks(tasks), skills, scenario, userId });
}

// Everything the About page and the receipts need.
export function getSources() {
  const snap = snapshot();
  return {
    snapshot_date: snap.date,
    llm_model_used: snap.manifest.llm_model_used ?? null,
    fetched_live: snap.manifest.fetched_live ?? false,
    fetched_at: snap.manifest.fetched_at ?? null,
    live_check: lastLiveCheck,
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

// Every task in our data, so a person can add one to their week. They can only pick from this list:
// the app never makes up a task. no_data = no published time, so AI-could-do dates can't be given for it.
export function getTasks() {
  const snap = snapshot();
  return [...snap.tasks.values()]
    .map((t) => ({
      task_id: t.task_id,
      name: t.task_description,
      job_id: t.job,
      job_name: snap.roles.get(t.job)?.role_name ?? null,
      no_data: (t.minutes_low ?? t.minutes_median) === null || (t.minutes_high ?? t.minutes_median) === null,
      source: t.source,
    }))
    .sort((a, b) => (a.job_name ?? "").localeCompare(b.job_name ?? "") || a.name.localeCompare(b.name));
}

// Every skill we know, so a person can pick theirs on "Build your own profile". Same rule as tasks:
// they can only pick from this list, the app never makes up a skill.
export function getSkills() {
  return [...snapshot().skills.values()]
    .map((s) => ({ skill_id: s.skill_id, name: s.skill_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

// Refresh = "go and check for new data".
//  1. Fetch METR's published time-horizon file and check it (ingest.js).
//  2. If it differs from the newest saved snapshot, write a new dated snapshot from it and load it.
//  3. If the fetch or the checks fail, say so and carry on with the newest saved snapshot, so the app
//     never ends up with no data on stage. (Set LIVE_REFRESH=0 to skip step 1, e.g. in tests.)
// Only one Refresh runs at a time; a second click gets the same answer instead of a second download.
let inFlight = null;
// The last time METR's file was checked live, and what we found. About shows it, so a judge can see the check happened.
let lastLiveCheck = null;
export function refreshData(options = {}) {
  if (!inFlight) inFlight = doRefresh(options).finally(() => { inFlight = null; });
  return inFlight;
}

async function doRefresh({ fetcher = fetchText, now = () => new Date() } = {}) {
  const previousSnap = current;
  const previous = previousSnap?.date ?? null;
  const checkedAt = now().toISOString();
  try {
    const dates = listSnapshots();
    if (!dates.length) throw new Error(`No snapshot folders in ${snapshotsDir()}`);
    const newest = dates[dates.length - 1];

    // Step 1 and 2: live data
    const live = { attempted: process.env.LIVE_REFRESH !== "0", ok: false, new_data: false, error: null, trend: null };
    if (live.attempted) {
      try {
        const rawText = await fetcher(METR_URL);
        const metr = validateMetr(parseMetr(rawText), now());
        const newestSnap = loadSnapshot(newest);
        live.ok = true;
        lastLiveCheck = { checked_at: checkedAt, url: METR_URL, result: "matches_saved" };
        if (!sameTrend(metr, newestSnap)) {
          live.trend = describeChange(metr, newestSnap);
          const written = writeLiveSnapshot({
            metr, rawText, baseDate: newest, dir: snapshotsDir(), today: checkedAt.slice(0, 10), fetchedAt: checkedAt,
          });
          current = loadSnapshot(written.date, written.dir);
          live.new_data = true;
          lastLiveCheck = { ...lastLiveCheck, result: "new_data" };
        }
      } catch (err) {
        live.error = err.message;
      }
    }

    // Step 3: nothing new live (or live failed): move forward to the newest saved snapshot, never backward.
    if (!live.new_data && (!current || newest > current.date)) current = loadSnapshot(newest);

    return {
      snapshot_date: current.date,
      previous,
      changed: current !== previousSnap,
      fallback: false,
      live: live.ok,
      live_attempted: live.attempted,
      live_error: live.error,
      checked_at: checkedAt,
      source_url: METR_URL,
      fetched_at: current.manifest.fetched_at ?? null,
      trend: live.trend,
      missing_files: current.missing,
      warnings: current.warnings,
    };
  } catch (err) {
    return { snapshot_date: previous, previous, changed: false, fallback: true, error: err.message, checked_at: checkedAt };
  }
}

// Accepts the shape the pages send and keeps only what the engine needs.
function cleanTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error("tasks must be a list of { task_id, hours }");
  return tasks.map((t) => ({ task_id: String(t.task_id), hours: Number(t.hours) || 0 }));
}
