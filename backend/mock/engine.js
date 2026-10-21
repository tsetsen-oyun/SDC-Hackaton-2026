// Fake engine so the frontend can be built before the real one lands.
const OLD_SNAPSHOT = process.env.START_SNAPSHOT || "2026-03-24";
const NEW_SNAPSHOT = "2026-10-20";
let snapshot = OLD_SNAPSHOT;

const FIRST = 2026, LAST = 2035;
const SCENARIO_SHIFT = { moderate: 0, fast: -1, slowdown: 1 };
const shiftYear = (y, s) => (y == null ? null : Math.min(LAST, Math.max(FIRST, y + s)));

const CATALOG = {
  t1: { name: "Enter invoice data", from: 2026, to: 2027, kind: "does" },
  t2: { name: "Match invoices to purchase orders", from: 2027, to: 2028, kind: "does" },
  t3: { name: "Flag duplicate payments", from: 2026, to: 2027, kind: "does" },
  t4: { name: "Answer supplier payment emails", from: 2027, to: 2029, kind: "helps" },
  t5: { name: "Investigate unusual invoices", from: 2030, to: 2033, kind: "helps" },
  t6: { name: "Resolve disputes with suppliers", from: 2034, to: null, kind: "helps" },
};

const SITI_HOURS = { t1: 12, t2: 8, t3: 4, t4: 6, t5: 5, t6: 5 };
const sitiTasks = Object.entries(SITI_HOURS).map(([task_id, hours]) => ({
  task_id, name: CATALOG[task_id].name, hours,
}));
const arifTasks = ["t1", "t2", "t3", "t4"].map((task_id) => ({
  task_id, name: CATALOG[task_id].name, hours: 0, share_ai: null,
}));

const PROFILES = [
  { id: "siti", name: "Siti", title: "Senior accounts-payable clerk",
    tasks: sitiTasks, skill_ids: ["s1", "s2"], target_job_tasks: [] },
  { id: "arif", name: "Arif", title: "Accounting graduate choosing a first job",
    target_job: "Junior accounts assistant",
    tasks: [], skill_ids: ["s3"], target_job_tasks: arifTasks },
];

export async function getProfiles() {
  return PROFILES;
}

export function forecast(tasks, scenario) {
  // newer data (after Refresh) moves everything one year earlier
  const shift = (SCENARIO_SHIFT[scenario] ?? 0) + (snapshot === NEW_SNAPSHOT ? -1 : 0);
  const source = { label: "Mock data (replace with real engine)", url: null, date: snapshot, isEstimate: true };

  const rows = tasks
    .filter((t) => CATALOG[t.task_id])
    .map((t) => {
      const c = CATALOG[t.task_id];
      return {
        task_id: t.task_id, name: c.name, hours: t.hours, kind: c.kind,
        from: shiftYear(c.from, shift), to: shiftYear(c.to, shift), source,
      };
    })
    .sort((a, b) => a.from - b.from || (a.to ?? 9999) - (b.to ?? 9999));

  // a task counts as "AI could do this" once the year passes the middle of its range
  const midpoint = (r) => (r.to == null ? r.from : (r.from + r.to) / 2);
  const total = rows.reduce((s, r) => s + r.hours, 0);
  const by_year = {};
  for (let y = FIRST; y <= LAST; y++) {
    const done = rows.filter((r) => y >= midpoint(r));
    const ai_hours = done.reduce((s, r) => s + r.hours, 0);
    by_year[y] = {
      ai_hours,
      human_hours: total - ai_hours,
      share_ai: total ? ai_hours / total : null,
      ai_task_ids: done.map((r) => r.task_id),
    };
  }

  const left = ["t5", "t6"].filter((id) => rows.some((r) => r.task_id === id));
  return {
    scenario, snapshot, source, tasks: rows, by_year,
    emerging_role: left.length
      ? { name: "Exception investigator", made_of: left, closest_job: "Fraud examiner (O*NET)", is_estimate: true, source }
      : null,
    skills: [
      { id: "s1", name: "Spotting fraud", trend: "rising", label: "robust" },
      { id: "s2", name: "Checking AI output", trend: "steady", label: "bet" },
      { id: "s3", name: "Data entry", trend: "declining", label: "trap" },
    ],
  };
}

export function getSources() {
  return {
    snapshotDate: snapshot,
    model: "Mock (no language model yet)",
    sources: [{ label: "Mock data", date: snapshot, url: null }],
    assumptions: ["This is placeholder data"],
  };
}

export async function refreshData() {
  snapshot = NEW_SNAPSHOT;
  return getSources();
}

// ---------- match ----------
const JOBS = [
  { job_id: "exc", title: "Exception investigator", is_estimate: true, trend: "rising",
    have0: 5, total: 10, tasks: 40, skills: 25, outlook: 13, drift: 1, planet: 2,
    scen: { moderate: 0, fast: 4, slowdown: -2 },
    missing: ["Fraud analytics basics", "Audit evidence", "ERP exception reports", "Forensic interviewing", "Case documentation"],
    sdg: [{ target: "16.5", label: "Reduce corruption", effect: 1, reason: "catches fraud" }] },
  { job_id: "inv", title: "AI invoice-review specialist", is_estimate: false, trend: "rising",
    have0: 4, total: 9, tasks: 38, skills: 22, outlook: 12, drift: 0.5, planet: -5,
    scen: { moderate: 0, fast: 6, slowdown: -5 },
    missing: ["Prompt writing for finance", "Reviewing AI output", "Data validation", "Process automation basics", "Audit sampling", "Spreadsheet automation"],
    sdg: [
      { target: "8.2", label: "Productivity through technology", effect: 1, reason: "faster invoice checks" },
      { target: "7 / 13", label: "Extra energy use from AI systems", effect: -1 },
    ] },
  { job_id: "esg", title: "ESG accounting assistant", is_estimate: false, trend: "steady",
    have0: 3, total: 8, tasks: 30, skills: 18, outlook: 13, drift: 0, planet: 20,
    scen: { moderate: 0, fast: 0, slowdown: 2 },
    missing: ["ESG reporting basics", "Carbon accounting", "Sustainability standards", "Data collection for ESG", "Stakeholder reporting"],
    sdg: [{ target: "12.6", label: "Company sustainability reporting", effect: 1 }] },
];

const rankBy = (list, key) => {
  const sorted = [...list].sort((a, b) => b[key] - a[key]);
  return Object.fromEntries(sorted.map((j, i) => [j.job_id, i + 1]));
};

export function match({ skills, scenario, mode }) {
  const boost = snapshot === NEW_SNAPSHOT ? 3 : 0; // newer data makes the top job look better
  const source = { label: "Mock data (replace with real engine)", url: null, date: snapshot, isEstimate: true };
  const by_year = {};

  for (let y = FIRST; y <= LAST; y++) {
    const jobs = JOBS.map((j) => {
      const have = Math.min(j.total, j.have0 + skills.length);
      const tasks = j.tasks + Math.round((y - 2029) * j.drift);
      const outlook = j.outlook + (j.scen[scenario] ?? 0) + (j.job_id === "exc" ? boost : 0);
      const score = tasks + j.skills + outlook;
      return {
        job_id: j.job_id, title: j.title, is_estimate: j.is_estimate, outlook_trend: j.trend,
        score, planet_score: score + j.planet,
        breakdown: { tasks, skills: j.skills, outlook },
        skills_have: have, skills_total: j.total,
        missing: j.missing.slice(0, j.total - have),
        sdg: j.sdg, source,
      };
    });
    const rm = rankBy(jobs, "score");
    const rp = rankBy(jobs, "planet_score");
    const ranked = jobs
      .map((j) => ({ ...j, rank_market: rm[j.job_id], rank_planet: rp[j.job_id] }))
      .sort((a, b) =>
        mode === "marketPlanet" ? a.rank_planet - b.rank_planet : a.rank_market - b.rank_market
      );
    by_year[y] = { jobs: ranked };
  }
  return { scenario, mode, snapshot, source, by_year };
}

// ---------- route ----------
// PLACEHOLDER courses only. Real courses must come from the team's real course list.
const ROUTES = {
  exc: [
    { skill: "Fraud detection basics", label: "robust", hours: 12 },
    { skill: "Audit evidence and documentation", label: "robust", hours: 10 },
    { skill: "Reviewing AI-processed invoices", label: "bet", hours: 8, note: "Pays off mainly if AI moves fast" },
  ],
  inv: [
    { skill: "Reviewing AI output", label: "robust", hours: 10 },
    { skill: "Data validation", label: "robust", hours: 8 },
    { skill: "Process automation basics", label: "bet", hours: 12, note: "Pays off mainly if AI moves fast" },
  ],
  esg: [
    { skill: "ESG reporting basics", label: "robust", hours: 14 },
    { skill: "Sustainability accounting", label: "robust", hours: 12 },
  ],
};

export function buildRoute({ jobId, scenario }) {
  const job = JOBS.find((j) => j.job_id === jobId);
  if (!job) throw new Error(`Unknown job: ${jobId}`);
  const source = { label: "Mock data (replace with real engine)", url: null, date: snapshot, isEstimate: true };

  // in a slowdown, "bet" skills are dropped because they only pay off if AI moves fast
  const specs = ROUTES[jobId].filter((s) => !(scenario === "slowdown" && s.label === "bet"));
  const steps = specs.map((s, i) => ({
    order: i + 1, skill: s.skill, label: s.label, note: s.note ?? null, source,
    course: {
      title: `[Placeholder] ${s.skill}`, provider: "Placeholder provider",
      hours: s.hours, cost: "Free", hrd_claimable: "check", url: null, checked: snapshot,
    },
  }));
  const total_hours = steps.reduce((t, s) => t + s.course.hours, 0);

  return {
    job_id: jobId, title: job.title, scenario, source,
    total_hours, total_weeks: Math.ceil(total_hours / 3.5),
    steps,
    stop_investing: [{ skill: "Manual data-entry speed", label: "trap", source }],
    sdg: [
      ...job.sdg,
      { target: "8.5", label: "Decent work", effect: 1 },
      { target: "4.4", label: "Relevant job skills", effect: 1 },
    ],
  };
}