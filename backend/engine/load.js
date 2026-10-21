// Reads one dated snapshot folder (data/snapshots/YYYY-MM-DD/) into plain objects.
// No calculations here: only reading, converting cells, and checking the files.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

const DEFAULT_DIR = fileURLToPath(new URL("../../data/snapshots/", import.meta.url));

// The engine can't run without these files.
const REQUIRED = {
  tasks: ["task_id", "job", "task_description", "minutes_median", "minutes_low", "minutes_high", "minutes_source", "source"],
  ai_progress: ["model", "release_date", "horizon_80pct_min", "source"],
  scenarios: ["scenario_id", "name", "doubling_days", "source"],
};

// These may not exist yet; the engine runs without them and reports them as missing.
const OPTIONAL = {
  slowdown_milestones: ["reliability", "task_length_minutes", "delay_years_under_slowdown", "source"],
  skills: ["skill_id", "skill_name"],
  task_skills: ["task_id", "skill_id"],
  job_skills: ["job_id", "skill_id"],
  roles: ["role_id", "role_name", "skill_ids"],
  users: ["user_id", "display_name", "current_job", "tasks"],
  sdg_links: ["item_type", "item_id", "sdg_target", "sign", "source"],
  courses: ["course_id", "skill_id", "course_name", "link"],
};

// Cells are text in a CSV, so we convert by column name.
// Codes like ISCO "0110" stay text on purpose: turning them into numbers would drop the leading zero.
const NUMBER_COLUMNS = new Set([
  "minutes_median", "minutes_low", "minutes_high", "aei_usage_share",
  "horizon_50pct_min", "horizon_80pct_min", "doubling_days",
  "task_length_minutes", "delay_years_under_slowdown", "hours",
]);
const LIST_COLUMNS = new Set(["task_ids", "skill_ids", "group_uri"]);

export function snapshotsDir() {
  return process.env.SNAPSHOTS_DIR || DEFAULT_DIR;
}

// Snapshot folders are named by date, so sorting the names sorts them by date.
export function listSnapshots(dir = snapshotsDir()) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort();
}

export function loadSnapshot(date, dir = snapshotsDir()) {
  const folder = path.join(dir, date);
  if (!fs.existsSync(folder)) throw new Error(`Snapshot ${date} not found in ${dir}`);

  const warnings = [];
  const missing = [];
  const manifest = readJson(path.join(folder, "manifest.json"));
  const params = readJson(path.join(folder, "params.json"));

  const files = {};
  for (const [name, columns] of Object.entries(REQUIRED)) {
    files[name] = readCsv(folder, name, columns, true);
  }
  for (const [name, columns] of Object.entries(OPTIONAL)) {
    files[name] = readCsv(folder, name, columns, false);
    if (files[name] === null) {
      missing.push(`${name}.csv`);
      files[name] = [];
    }
  }

  // The manifest may list sources as an array or as an object keyed by id.
  const sourceList = Array.isArray(manifest.sources)
    ? manifest.sources
    : Object.entries(manifest.sources || {}).map(([id, s]) => ({ id, ...s }));
  const sources = new Map(sourceList.map((s) => [s.id, s]));

  const tasks = byId(files.tasks, "task_id", warnings);
  for (const t of tasks.values()) checkMinutes(t, warnings);

  const roles = byId(files.roles.map(splitOccupationCode), "role_id", warnings);
  const skills = byId(files.skills, "skill_id", warnings);
  // A task with its own links in task_skills.csv uses them. Every other task gets its whole job's
  // skill list from roles.csv (published ESCO, no AI).
  const linked = linkTaskSkills(files.task_skills, tasks, allowedJobSkills(roles, files.job_skills), skills, warnings);
  const taskSkills = jobLevelSkills(tasks, roles);
  for (const [taskId, list] of linked) taskSkills.set(taskId, list);
  const skillLinks = linked.size ? "task" : "job";
  // The receipt says who picked the task links: an AI model (estimate) or our team (not an estimate).
  const taskLinksAreEstimates = files.task_skills.some((row) => row.is_estimate === true);
  const users = byId(files.users.map(parseUserTasks), "user_id", warnings);

  for (const u of users.values()) {
    for (const { task_id } of u.tasks) {
      if (!tasks.has(task_id)) warnings.push(`users.csv: ${u.user_id} has unknown task ${task_id}`);
    }
  }

  checkSourceIds(files, sources, warnings);

  return {
    date,
    manifest,
    params,
    sources,
    tasks,
    aiProgress: files.ai_progress,
    scenarios: byId(files.scenarios, "scenario_id", warnings),
    milestones: usableMilestones(files.slowdown_milestones, warnings),
    skills,
    taskSkills,
    skillLinks,
    tasksWithOwnLinks: linked.size,
    taskLinksAreEstimates,
    roles,
    users,
    sdgLinks: cleanSdgLinks(files.sdg_links, warnings),
    courses: files.courses,
    missing,
    warnings,
  };
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${path.basename(file)} in ${path.dirname(file)}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Returns the rows, or null when an optional file doesn't exist.
function readCsv(folder, name, columns, required) {
  const file = path.join(folder, `${name}.csv`);
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`Missing ${name}.csv in ${folder}`);
    return null;
  }
  // bom: true removes the invisible mark Excel puts at the start of a file.
  const rows = parse(fs.readFileSync(file, "utf8"), { columns: true, skip_empty_lines: true, trim: true, bom: true });
  const header = rows.length ? Object.keys(rows[0]) : [];
  const absent = columns.filter((c) => !header.includes(c));
  if (rows.length && absent.length) throw new Error(`${name}.csv is missing columns: ${absent.join(", ")}`);
  return rows.map(convertRow);
}

function convertRow(row) {
  const out = {};
  for (const [key, raw] of Object.entries(row)) {
    const value = raw === "" ? null : raw;
    if (value === null) out[key] = LIST_COLUMNS.has(key) ? [] : null;
    else if (NUMBER_COLUMNS.has(key)) out[key] = Number(value);
    else if (LIST_COLUMNS.has(key)) out[key] = value.split(";").map((s) => s.trim()).filter(Boolean);
    else if (key === "is_estimate" || key.endsWith("_is_estimate")) out[key] = value.toLowerCase() === "true";
    else out[key] = value;
  }
  return out;
}

function byId(rows, idColumn, warnings) {
  const map = new Map();
  for (const row of rows) {
    if (map.has(row[idColumn])) warnings.push(`Duplicate ${idColumn} ${row[idColumn]}: kept the first one`);
    else map.set(row[idColumn], row);
  }
  return map;
}

// The engine works out one date from minutes_low and one from minutes_high, so it needs low <= median <= high.
function checkMinutes(t, warnings) {
  const { minutes_low: low, minutes_median: mid, minutes_high: high } = t;
  const given = [low, mid, high].filter((v) => v !== null).length;
  if (given > 0 && given < 3) warnings.push(`tasks.csv: ${t.task_id} has only some of its minutes`);
  if (given === 3 && !(low <= mid && mid <= high)) warnings.push(`tasks.csv: ${t.task_id} breaks low <= median <= high`);
}

// The forecast starts from the 80% horizon, so only the paper's 80% delays fit it; the 50% rows are left out.
// A milestone with no published length in minutes can't be placed on the curve, so it's skipped with a warning.
function usableMilestones(rows, warnings) {
  const kept = [];
  for (const row of rows) {
    if (row.reliability !== "80%") continue;
    if (row.task_length_minutes === null || row.delay_years_under_slowdown === null) {
      warnings.push(`slowdown_milestones.csv: skipped "${row.milestone}" (no length in minutes or no delay)`);
      continue;
    }
    kept.push(row);
  }
  return kept.sort((a, b) => a.task_length_minutes - b.task_length_minutes);
}

// Until Darishka splits the column: "O*NET;ESCO;ISCO" in one cell becomes three fields.
function splitOccupationCode(role) {
  if (role.onet_code === undefined && typeof role.occupation_code === "string") {
    const [onet_code = null, esco_uri = null, isco_code = null] = role.occupation_code.split(";").map((s) => s.trim() || null);
    return { ...role, onet_code, esco_uri, isco_code };
  }
  return role;
}

// "TASK_1:12;TASK_2:8" becomes [{ task_id: "TASK_1", hours: 12 }, { task_id: "TASK_2", hours: 8 }].
function parseUserTasks(user) {
  const tasks = (user.tasks || "").split(";").filter(Boolean).map((pair) => {
    const [task_id, hours] = pair.split(":").map((s) => s.trim());
    return { task_id, hours: Number(hours) };
  });
  return { ...user, tasks };
}

// Each job's ESCO skills a task link may use: the essential ones in roles.csv,
// plus the optional ones in job_skills.csv when that file is in the snapshot.
function allowedJobSkills(roles, jobSkillRows) {
  const allowed = new Map([...roles.values()].map((r) => [r.role_id, new Set(r.skill_ids)]));
  for (const row of jobSkillRows) {
    if (!allowed.has(row.job_id)) allowed.set(row.job_id, new Set());
    allowed.get(row.job_id).add(row.skill_id);
  }
  return allowed;
}

// Task links (picked by our team or an AI model) may only use skills from the task's own job.
// Any other link is dropped, so a wrong pick can't reach the results.
function linkTaskSkills(rows, tasks, allowed, skills, warnings) {
  const links = new Map();
  for (const row of rows) {
    const task = tasks.get(row.task_id);
    const jobSkills = task && allowed.get(task.job);
    let problem = null;
    if (!task) problem = "unknown task";
    else if (skills.size && !skills.has(row.skill_id)) problem = "unknown skill";
    else if (jobSkills && !jobSkills.has(row.skill_id)) problem = `skill not in ${task.job}'s list`;
    if (problem) {
      warnings.push(`task_skills.csv: dropped ${row.task_id} -> ${row.skill_id} (${problem})`);
      continue;
    }
    if (!links.has(row.task_id)) links.set(row.task_id, []);
    links.get(row.task_id).push(row.skill_id);
  }
  return links;
}

// Fallback when task_skills.csv is missing: every task of a job gets that job's skill list.
// These links are published, but they can't tell one task of a job from another.
function jobLevelSkills(tasks, roles) {
  const links = new Map();
  for (const t of tasks.values()) {
    const jobSkills = roles.get(t.job)?.skill_ids;
    if (jobSkills?.length) links.set(t.task_id, [...jobSkills]);
  }
  return links;
}

// A link a person checked and marked "no" is hidden. Both minus signs (- and −) mean a negative link;
// any other sign is dropped, so a typo can't count as negative.
function cleanSdgLinks(rows, warnings) {
  const kept = [];
  for (const row of rows) {
    if (row.reviewed?.toLowerCase() === "no") continue;
    const sign = row.sign === "+" ? "+" : row.sign === "-" || row.sign === "−" ? "-" : null;
    if (!sign) {
      warnings.push(`sdg_links.csv: dropped ${row.item_id} -> ${row.sdg_target} (sign "${row.sign}" is not + or -)`);
      continue;
    }
    kept.push({ ...row, sign });
  }
  return kept;
}

// Every source column must hold ids from manifest.json, otherwise the receipt has nothing to show.
// Each unknown id is reported once per file, not once per row.
function checkSourceIds(files, sources, warnings) {
  const reported = new Set();
  for (const [name, rows] of Object.entries(files)) {
    for (const row of rows) {
      for (const id of splitSourceIds([row.source, row.minutes_source])) {
        if (!sources.has(id) && !reported.has(`${name}:${id}`)) {
          reported.add(`${name}:${id}`);
          warnings.push(`${name}.csv: source id "${id}" is not in manifest.json`);
        }
      }
    }
  }
}

// A source cell can hold several ids separated by ";", e.g. "onet;aei_2026_03".
// Returns each id once, with blanks dropped. The forecast and match receipts use this too.
export function splitSourceIds(cells) {
  const ids = cells.filter(Boolean).flatMap((cell) => String(cell).split(";")).map((s) => s.trim());
  return [...new Set(ids.filter(Boolean))];
}
