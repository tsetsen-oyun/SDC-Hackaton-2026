// Turns the engine's answers into the shape Oyuka's pages read (the same shape as backend/mock/engine.js).
// No calculations here: only renaming fields, turning ids into names, and building the ⓘ receipts.
// server.js imports this file; the engine itself (index.js) keeps its own tested shape.
import * as engine from "./index.js";
import { WEIGHTS, RELATED_CREDIT, SDG_POINTS } from "./match.js";
import { HOURS_PER_WEEK } from "./route.js";

// The UN's short names of the 17 goals, for the SDG pills.
const SDG_GOALS = {
  1: "No poverty", 2: "Zero hunger", 3: "Good health and well-being", 4: "Quality education",
  5: "Gender equality", 6: "Clean water and sanitation", 7: "Affordable and clean energy",
  8: "Decent work and economic growth", 9: "Industry, innovation and infrastructure",
  10: "Reduced inequalities", 11: "Sustainable cities and communities",
  12: "Responsible consumption and production", 13: "Climate action", 14: "Life below water",
  15: "Life on land", 16: "Peace, justice and strong institutions", 17: "Partnerships for the goals",
};

// The pages' HRD Corp labels: we haven't checked any course, so "unknown" becomes "check with provider".
const HRD = { yes: "yes", no: "no", unknown: "check" };

// An ⓘ receipt { label, url, date, isEstimate } from source ids in manifest.json.
function receipt(snap, ids, isEstimate) {
  const found = ids.map((id) => snap.sources.get(id)).filter(Boolean);
  return {
    label: found.length ? found.map((s) => `${s.name} (${s.date_taken})`).join(" · ") : ids.join(", "),
    url: found.find((s) => s.url)?.url ?? null,
    date: snap.date,
    isEstimate: Boolean(isEstimate),
  };
}

const skillName = (snap, id) => snap.skills.get(id)?.skill_name ?? id;

// Only tasks with hours are the person's week. Zero-hour tasks are a target job they don't do yet.
const worked = (tasks) => tasks.filter((t) => t.hours > 0);

function sdgPills(links) {
  return links.map((l) => ({
    target: l.target ?? l.sdg_target,
    label: SDG_GOALS[parseInt(l.target ?? l.sdg_target, 10)] ?? null,
    effect: l.sign === "-" ? -1 : 1,
    reason: l.reason ?? l.one_line_reason ?? null,
    // Empty until a person checks the link, so the page can say "not yet checked".
    reviewed: l.reviewed ?? null,
    // true when SDSN says Malaysia is off track on this goal (it counts double in the planet ranking).
    malaysia_off_track: l.malaysia_off_track ?? null,
  }));
}

export function getProfiles() {
  const snap = engine.snapshot();
  return engine.getProfiles().map((p) => ({
    id: p.user_id,
    name: p.display_name,
    title: p.current_job_name ?? (p.target_job_name ? `No current job · aiming for ${p.target_job_name}` : "No current job"),
    target_job: p.target_job_name,
    tasks: p.tasks.map(({ task_id, name, hours }) => ({ task_id, name, hours })),
    // Their own skills plus the skills of the tasks they do, so the Map and Route pages can send them.
    skill_ids: [...new Set([...p.skill_ids, ...p.tasks.flatMap((t) => snap.taskSkills.get(t.task_id) ?? [])])],
    target_job_tasks: p.target_job_tasks.map(({ task_id, name }) => ({ task_id, name, hours: 0, share_ai: null })),
  }));
}

export function forecast(tasks, scenario) {
  const snap = engine.snapshot();
  const f = engine.forecast(tasks, scenario);
  // "What's left" changes with the year, and the engine works it out in match.
  const m = engine.match({ tasks: worked(tasks), skills: [], scenario });

  const rows = f.tasks.map((t) => ({
    task_id: t.task_id,
    name: t.name,
    hours: t.hours,
    // null when Anthropic's data doesn't say whether AI does the task or helps with it.
    kind: t.mode === "automate" ? "does" : t.mode === "augment" ? "helps" : null,
    // Whole years for the page. null when there's no published time for the task.
    from: t.status === "dated" ? Math.round(t.from) : null,
    to: t.status === "dated" ? Math.round(t.to) : null,
    no_data: t.status !== "dated",
    note: t.reason ?? null,
    source: receipt(snap, t.sources, t.is_estimate),
  }));
  // Earliest first, as the page says; tasks with no data go last.
  rows.sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity) || (a.to ?? Infinity) - (b.to ?? Infinity));

  const by_year = {};
  for (const y of f.years) {
    const w = f.by_year[y];
    const left = new Set(w.leftover_task_ids);
    const er = m.by_year[y].emerging_role;
    by_year[y] = {
      ai_hours: w.hours_ai,
      human_hours: w.hours_total - w.hours_ai,
      no_data_hours: w.hours_no_data,
      share_ai: w.share_ai,
      ai_task_ids: f.tasks.filter((t) => !left.has(t.task_id)).map((t) => t.task_id),
      emerging_role: er && {
        name: er.name,
        made_of: w.leftover_task_ids,
        closest_job: er.closest_real_occupation,
        is_estimate: true,
        source: receipt(snap, er.sources, true),
      },
    };
  }

  return {
    scenario,
    snapshot: f.snapshot_date,
    source: receipt(snap, [...new Set(f.tasks.flatMap((t) => t.sources))], true),
    tasks: rows,
    by_year,
    // Per year now: the page should read by_year[year].emerging_role. null here so nothing out of date shows.
    emerging_role: null,
    // Weather cards come with skills.js.
    skills: [],
  };
}

export function match({ tasks, skills = [], scenario, mode = "market" }) {
  const snap = engine.snapshot();
  const args = { tasks: worked(tasks), skills, scenario };
  const market = engine.match({ ...args, mode: "market" });
  const planet = engine.match({ ...args, mode: "marketPlanet" });
  const shown = mode === "marketPlanet" ? planet : market;
  const ranks = (roles) => Object.fromEntries(roles.map((r, i) => [r.role_id, i + 1]));
  const lastYear = market.years[market.years.length - 1];

  const by_year = {};
  for (const y of market.years) {
    const rankMarket = ranks(market.by_year[y].roles);
    const rankPlanet = ranks(planet.by_year[y].roles);
    const planetScore = Object.fromEntries(planet.by_year[y].roles.map((r) => [r.role_id, r.score]));
    // Outlook two years on, to show whether AI could soon do more of the job's tasks.
    const later = Object.fromEntries(market.by_year[Math.min(y + 2, lastYear)].roles.map((r) => [r.role_id, r.parts.outlook]));

    by_year[y] = {
      jobs: shown.by_year[y].roles.map((r) => ({
        job_id: r.role_id,
        title: r.name,
        // The jobs are real occupations; the score on them is our estimate (see the receipt).
        is_estimate: Boolean(snap.roles.get(r.role_id)?.is_estimate),
        outlook_trend: later[r.role_id] !== null && later[r.role_id] < r.parts.outlook ? "declining" : "steady",
        score: r.score,
        planet_score: planetScore[r.role_id],
        breakdown: { tasks: r.parts.leftover, skills: r.parts.skills, outlook: r.parts.outlook },
        skills_have: r.have,
        skills_related: r.related,
        skills_total: r.need,
        shares_skills: r.shares_skills,
        // Related ones first: they're the quickest to learn.
        missing: [...r.related_skill_ids, ...r.missing_skill_ids.filter((s) => !r.related_skill_ids.includes(s))]
          .map((s) => skillName(snap, s)),
        sdg: sdgPills(r.sdg),
        source: receipt(snap, r.sources, true),
        rank_market: rankMarket[r.role_id],
        rank_planet: rankPlanet[r.role_id],
      })),
    };
  }
  return { scenario, mode, snapshot: market.snapshot_date, source: receipt(snap, [], true), by_year, skill_links: market.skill_links };
}

export function buildRoute({ jobId, skills = [], scenario }) {
  const snap = engine.snapshot();
  const r = engine.buildRoute({ jobId, skills });
  const sdg = sdgPills(snap.sdgLinks.filter((l) => l.item_type === "role" && l.item_id === jobId)
    .map((l) => ({ ...l, malaysia_off_track: snap.offTrackGoals.has(String(l.sdg_target).split(".")[0]) })));
  if (r.status !== "ready") {
    return { job_id: jobId, title: snap.roles.get(jobId)?.role_name ?? jobId, scenario, message: r.message,
      steps: [], total_hours: 0, total_weeks: 0, stop_investing: [], sdg, source: receipt(snap, [], false) };
  }
  return {
    job_id: r.role_id,
    title: r.role_name,
    scenario,
    source: receipt(snap, r.sources, true),
    total_hours: r.total_hours,
    total_weeks: r.total_weeks,
    hours_per_week: r.hours_per_week,
    courses_without_hours: r.courses_without_hours,
    steps: r.steps.map((s) => ({
      order: s.order,
      skill: skillName(snap, s.skill_id),
      // robust / bet / trap come with skills.js.
      label: null,
      related: s.related,
      note: s.related ? "Close to a skill you already have" : null,
      source: { ...receipt(snap, [s.course.source], false), url: s.course.link, date: s.course.date_checked },
      course: {
        title: s.course.course_name,
        provider: s.course.provider,
        // null when the course page gives no hours; stated_duration then has its own words.
        hours: s.course.hours,
        stated_duration: s.course.stated_duration ?? null,
        cost: s.course.cost,
        hrd_claimable: HRD[s.course.hrd_corp_claimable] ?? "check",
        url: s.course.link,
        checked: s.course.date_checked,
      },
    })),
    no_course: r.no_course_skill_ids.map((s) => skillName(snap, s)),
    stop_investing: [],
    sdg,
  };
}

// The mentor card: written from the point of view of the person on screen ("you bring" / "they bring").
// The other person's name is only shown on the card; the engine never reads it.
export function mentor({ tasks = [], skills = [], scenario, userId = null }) {
  const snap = engine.snapshot();
  const r = engine.mentor({ tasks: worked(tasks), skills, scenario, userId });
  const names = (ids) => ids.map((s) => skillName(snap, s));
  return {
    scenario,
    snapshot: r.snapshot_date,
    consent_note: r.consent_note,
    pairs: r.pairs.map((p) => {
      const senior = p.person_side === "senior";
      const by_year = {};
      for (const [y, w] of Object.entries(p.by_year)) {
        by_year[y] = {
          possible: w.possible,
          you_bring: names(senior ? w.senior_brings : w.junior_brings),
          they_bring: names(senior ? w.junior_brings : w.senior_brings),
          // The job the senior fits best that year, so the card can say what the senior is moving towards.
          senior_next_job: snap.roles.get(w.senior_top_role)?.role_name ?? null,
        };
      }
      return {
        with_id: p.user_id,
        with_name: snap.users.get(p.user_id)?.display_name ?? p.user_id,
        you_are: p.person_side,
        by_year,
        source: receipt(snap, p.sources, p.is_estimate),
      };
    }),
  };
}

export function getSources() {
  const s = engine.getSources();
  const snap = engine.snapshot();
  const frontier = snap.aiProgress.filter((r) => r.horizon_80pct_min !== null)
    .reduce((best, r) => (r.horizon_80pct_min > best.horizon_80pct_min ? r : best));
  const D = snap.params.domain_discount;
  return {
    snapshotDate: s.snapshot_date,
    snapshot_date: s.snapshot_date,
    model: s.llm_model_used,
    sources: s.sources.map((x) => ({ label: x.name, url: x.url ?? null, date: x.date_taken ?? null, licence: x.licence ?? null })),
    // Plain-language list of every assumption behind the numbers, for the About page.
    assumptions: [
      `Starting point: the longest task the newest model can do at 80% reliability (${frontier.model}, released ${frontier.release_date}: ${frontier.horizon_80pct_min} minutes, METR).`,
      D ? `Office work counts as ${D} times harder for AI than METR's software tasks (METR's study of other domains).` : "No office-work factor.",
      snap.params.adoption_delay_years
        ? `Companies start using AI ${snap.params.adoption_delay_years} years after it could do a task.`
        : "No delay is added for companies to start using AI: every date means AI could do the task, not that it will.",
      "Slowdown scenario: the published delays at 80% reliability (Whitfill, Snodin & Becker). The authors call it illustrative.",
      "A task counts as \"AI could do this\" once the year passes the middle of its date range.",
      "Tasks with no published time in Anthropic's data are never counted as something AI could do.",
      `Match score (our weighting): skills ${WEIGHTS.skills * 100}%, fit with what's left of your week ${WEIGHTS.leftover * 100}%, job outlook ${WEIGHTS.outlook * 100}%. A missing skill in the same ESCO group as one you have counts ${RELATED_CREDIT}.`,
      `Market + planet ranking (our weighting): each SDG goal a job helps adds ${SDG_POINTS.goal} points (or takes them away if it harms it), ${SDG_POINTS.off_track_goal} if Malaysia is off track on that goal (SDSN, ${snap.malaysiaSdg.length ? `off track on goals ${[...snap.offTrackGoals].join(", ")}` : "no status in this snapshot"}). Each goal counts once per job, and the total is at most ${SDG_POINTS.cap} points either way.`,
      `Route weeks assume ${HOURS_PER_WEEK} hours of study a week. Course cost and length are as written on the course page on the date checked. HRD Corp status is not checked.`,
      "Name and age are never used in any calculation.",
    ],
    scenarios: s.scenarios,
    warnings: s.warnings,
  };
}

// A failed Refresh is an error here, so the top bar shows "still using the saved copy".
export async function refreshData() {
  const r = await engine.refreshData();
  if (r.fallback) throw new Error(r.error ?? "Couldn't load the newest snapshot");
  return { ...r, snapshotDate: r.snapshot_date };
}
