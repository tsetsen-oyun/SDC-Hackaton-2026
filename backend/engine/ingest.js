// Live trend data: fetch METR's published time-horizon file, check it, and turn it into a dated snapshot.
//
// What this file does NOT do: any forecasting. It only replaces two files of a snapshot
// (ai_progress.csv and scenarios.csv) with numbers METR published, and copies everything else
// from the newest saved snapshot. The engine then reads the new snapshot like any other.
//
// METR's file layout (documented in github.com/METR/eval-analysis-public, generate_benchmark_results.py):
//   results:
//     <model>:
//       release_date: YYYY-MM-DD
//       metrics:
//         p50_horizon_length: { estimate, ci_low, ci_high }   # minutes
//         p80_horizon_length: { estimate, ci_low, ci_high }   # minutes
//   doubling_time_in_days:
//     all_time (or all_time_stitched): { point_estimate, ci_low, ci_high }
//     from_2023_on:                    { point_estimate, ci_low, ci_high }
//
// If METR changes this layout, validation fails, nothing is written, and Refresh falls back
// to the saved snapshots. That is the plan for our biggest risk: an upstream format change.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { load as loadYaml } from "js-yaml";
import { parse } from "csv-parse/sync";

export const METR_URL = "https://metr.org/assets/benchmark_results_1_1.yaml";
export const METR_SOURCE_ID = "metr_th_1_1";
const MAX_BYTES = 5_000_000;
const MIN_MODELS = 15;

// ---------- fetching ----------

export async function fetchText(url = METR_URL, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "unbundle-hackathon/1.0 (student research prototype)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error(`Response from ${url} is unexpectedly large`);
    return text;
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`Timed out after ${timeoutMs / 1000}s fetching ${url}`);
    // Node's own message is just "fetch failed"; the real reason is in err.cause.
    if (err.message === "fetch failed") throw new Error(`Could not reach ${new URL(url).host}${err.cause?.code ? ` (${err.cause.code})` : ""}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- parsing and checking ----------

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// YAML turns an unquoted 2025-11-19 into a Date, so accept both a Date and a string.
function isoDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  return null;
}

function trendStats(raw) {
  const point = num(raw?.point_estimate);
  if (point === null) return null;
  return { point, low: num(raw.ci_low), high: num(raw.ci_high) };
}

// Text in, plain object out. Throws a readable error when the file is not what we expect.
export function parseMetr(text) {
  let doc;
  try {
    doc = loadYaml(text);
  } catch (err) {
    throw new Error(`METR file is not valid YAML: ${err.message}`);
  }
  if (!doc || typeof doc !== "object" || !doc.results || typeof doc.results !== "object") {
    throw new Error("METR file has no `results` section (has the format changed?)");
  }

  const models = [];
  let skipped = 0;
  for (const [model, row] of Object.entries(doc.results)) {
    const p50 = num(row?.metrics?.p50_horizon_length?.estimate);
    const p80 = num(row?.metrics?.p80_horizon_length?.estimate);
    const date = isoDate(row?.release_date);
    if (p50 === null || p80 === null || !date) {
      skipped++;
      continue;
    }
    models.push({ model, release_date: date, horizon_50pct_min: round2(p50), horizon_80pct_min: round2(p80) });
  }
  models.sort((a, b) => a.release_date.localeCompare(b.release_date) || a.model.localeCompare(b.model));

  const dt = doc.doubling_time_in_days ?? {};
  return {
    benchmark_name: typeof doc.benchmark_name === "string" ? doc.benchmark_name : null,
    models,
    skipped,
    doubling: {
      all_time: trendStats(dt.all_time ?? dt.all_time_stitched),
      from_2023_on: trendStats(dt.from_2023_on),
    },
  };
}

// Refuse anything that looks wrong, so a bad download can never reach the forecast.
export function validateMetr(metr, now = new Date()) {
  const problems = [];
  if (metr.models.length < MIN_MODELS) problems.push(`only ${metr.models.length} usable models (need at least ${MIN_MODELS})`);

  const latestOk = new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  let swapped = 0;
  for (const m of metr.models) {
    if (!(m.horizon_50pct_min > 0 && m.horizon_80pct_min > 0)) problems.push(`${m.model}: horizon is not positive`);
    if (m.horizon_50pct_min > 1e7 || m.horizon_80pct_min > 1e7) problems.push(`${m.model}: horizon is implausibly large (wrong unit?)`);
    if (m.release_date < "2018-01-01" || m.release_date > latestOk) problems.push(`${m.model}: release date ${m.release_date} is out of range`);
    // The 80% horizon is never longer than the 50% one. Many violations would mean the fields got swapped.
    if (m.horizon_80pct_min > m.horizon_50pct_min * 1.001) swapped++;
  }
  if (metr.models.length && swapped / metr.models.length > 0.2) problems.push("50% and 80% horizons look swapped");

  for (const [name, d] of Object.entries(metr.doubling)) {
    if (!d) problems.push(`doubling time "${name}" is missing`);
    else if (!(d.point >= 30 && d.point <= 1500)) problems.push(`doubling time "${name}" = ${d.point} days is implausible`);
  }
  if (problems.length) throw new Error(`METR data failed checks: ${problems.slice(0, 5).join("; ")}`);
  return metr;
}

// The model that sets the starting point of the forecast (same rule as forecast.js).
export function frontierOf(rows) {
  const measured = rows.filter((r) => typeof r.horizon_80pct_min === "number");
  if (!measured.length) return null;
  const best = measured.reduce((a, r) => (r.horizon_80pct_min > a.horizon_80pct_min ? r : a));
  return { model: best.model, release_date: best.release_date, horizon_80pct_min: best.horizon_80pct_min };
}

// Is METR's file the same as what a loaded snapshot already holds?
export function sameTrend(metr, snap) {
  const key = (r) => `${r.model}|${r.release_date}|${round2(r.horizon_50pct_min ?? -1)}|${round2(r.horizon_80pct_min ?? -1)}`;
  const a = metr.models.map(key).sort().join("\n");
  const b = snap.aiProgress.map(key).sort().join("\n");
  if (a !== b) return false;
  const close = (x, y) => x !== null && y !== null && Math.abs(x - y) < 0.0015;
  return (
    close(metr.doubling.all_time.point, snap.scenarios.get("moderate")?.doubling_days ?? null) &&
    close(metr.doubling.from_2023_on.point, snap.scenarios.get("fast")?.doubling_days ?? null)
  );
}

// What changed, in a few numbers the Refresh message can show.
export function describeChange(metr, snap) {
  const known = new Set(snap.aiProgress.map((r) => r.model));
  return {
    new_models: metr.models.filter((m) => !known.has(m.model)).map((m) => m.model),
    frontier_before: frontierOf(snap.aiProgress),
    frontier_after: frontierOf(metr.models),
    moderate_doubling_days: { before: snap.scenarios.get("moderate")?.doubling_days ?? null, after: metr.doubling.all_time.point },
    fast_doubling_days: { before: snap.scenarios.get("fast")?.doubling_days ?? null, after: metr.doubling.from_2023_on.point },
  };
}

// ---------- writing a snapshot ----------

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const toCsv = (header, rows) => [header.join(","), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(","))].join("\n") + "\n";

const AI_PROGRESS_HEADER = ["model", "release_date", "horizon_50pct_min", "horizon_80pct_min", "source", "date"];

function updateManifest(manifest, { today, fetchedAt, baseDate }) {
  const entry = {
    id: METR_SOURCE_ID,
    name: "METR Time Horizon 1.1, fetched live from metr.org (benchmark_results_1_1.yaml)",
    url: METR_URL,
    date_taken: today,
    licence: "No licence stated - published numbers cited only",
    fetched_live: true,
    fetched_at: fetchedAt,
  };
  let sources = manifest.sources ?? [];
  if (Array.isArray(sources)) {
    const i = sources.findIndex((s) => s.id === METR_SOURCE_ID);
    sources = i >= 0 ? sources.map((s, j) => (j === i ? { ...s, ...entry } : s)) : [...sources, entry];
  } else {
    const { id, ...rest } = entry;
    sources = { ...sources, [id]: { ...(sources[id] ?? {}), ...rest } };
  }
  return {
    ...manifest,
    snapshot_date: today,
    sources,
    fetched_live: true,
    fetched_at: fetchedAt,
    derived_from: baseDate,
    note: `Trend data (ai_progress.csv, scenarios.csv) fetched live from METR on ${fetchedAt}. Every other file is copied from snapshot ${baseDate}.`,
  };
}

// Creates data/snapshots/<today>/ from the newest saved snapshot plus METR's numbers.
// Returns { date, dir }. If the data folder can't be written (some hosts are read-only),
// it writes to the system temp folder instead, so Refresh still works for this run.
export function writeLiveSnapshot({ metr, rawText, baseDate, dir, today, fetchedAt }) {
  try {
    return { date: writeInto(dir), dir };
  } catch (err) {
    if (!["EACCES", "EROFS", "EPERM", "ENOSPC"].includes(err.code)) throw err;
    const tmp = path.join(os.tmpdir(), "unbundle-snapshots");
    fs.mkdirSync(tmp, { recursive: true });
    fs.cpSync(path.join(dir, baseDate), path.join(tmp, baseDate), { recursive: true });
    return { date: writeInto(tmp), dir: tmp };
  }

  function writeInto(root) {
    const base = path.join(root, baseDate);
    const target = path.join(root, today);
    // Never overwrite a snapshot a person made by hand, even if it has today's date.
    if (fs.existsSync(target)) {
      const old = JSON.parse(fs.readFileSync(path.join(target, "manifest.json"), "utf8"));
      if (!old.fetched_live) throw new Error(`Snapshot ${today} already exists and was not made by a live fetch, so it was not overwritten`);
    }
    if (baseDate !== today) {
      fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(base, target, { recursive: true });
    }

    // ai_progress.csv
    fs.writeFileSync(
      path.join(target, "ai_progress.csv"),
      toCsv(AI_PROGRESS_HEADER, metr.models.map((m) => ({ ...m, source: METR_SOURCE_ID, date: today })))
    );

    // scenarios.csv: only the two steady-pace rows change; the slowdown row stays as it was.
    const scenarioFile = path.join(target, "scenarios.csv");
    const rows = parse(fs.readFileSync(scenarioFile, "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const header = Object.keys(rows[0] ?? {});
    const byId = new Map(rows.map((r) => [r.scenario_id, r]));
    if (!byId.has("moderate") || !byId.has("fast")) throw new Error("scenarios.csv has no moderate/fast rows to update");
    const { all_time: all, from_2023_on: recent } = metr.doubling;
    byId.get("moderate").doubling_days = all.point;
    byId.get("moderate").assumption_note = `METR all-time doubling time (live fetch ${fetchedAt.slice(0, 10)})`;
    const ci = recent.low !== null && recent.high !== null ? `; 95% CI ${recent.low}-${recent.high} days` : "";
    byId.get("fast").doubling_days = recent.point;
    byId.get("fast").assumption_note = `METR doubling time from 2023 on${ci} (live fetch ${fetchedAt.slice(0, 10)})`;
    fs.writeFileSync(scenarioFile, toCsv(header, rows));

    // params.json: the forecast counts years from reference_date
    const paramsFile = path.join(target, "params.json");
    const params = JSON.parse(fs.readFileSync(paramsFile, "utf8"));
    fs.writeFileSync(paramsFile, JSON.stringify({ ...params, reference_date: today }, null, 2) + "\n");

    // manifest.json, plus METR's raw file kept next to the snapshot as evidence
    const manifestFile = path.join(target, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    fs.writeFileSync(manifestFile, JSON.stringify(updateManifest(manifest, { today, fetchedAt, baseDate }), null, 2) + "\n");
    fs.writeFileSync(path.join(target, "metr_benchmark_results_1_1.yaml"), rawText);
    return today;
  }
}
