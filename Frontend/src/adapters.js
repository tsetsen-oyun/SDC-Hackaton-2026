// Turns the engine's raw JSON into the shapes our pages read.
// If the engine's field names change again, this is the ONLY file to edit.

const GOALS = {
  1: "No poverty", 2: "Zero hunger", 3: "Good health and well-being", 4: "Quality education",
  5: "Gender equality", 6: "Clean water and sanitation", 7: "Affordable and clean energy",
  8: "Decent work and economic growth", 9: "Industry, innovation and infrastructure",
  10: "Reduced inequalities", 11: "Sustainable cities and communities",
  12: "Responsible consumption and production", 13: "Climate action", 14: "Life below water",
  15: "Life on land", 16: "Peace, justice and strong institutions", 17: "Partnerships for the goals",
};

const short = (name = "") => name.split(/ [(,:]|, /)[0].trim();
const clip = (s, n = 140) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const goalOf = (target) => GOALS[parseInt(String(target), 10)] ?? "";

// ids like "metr_th_1_1" -> one object the Receipt popup can show
export function resolveSources(ids, manifest, isEstimate = false) {
  const list = (manifest?.sources ?? []);
  const found = (ids ?? []).map((id) => list.find((s) => s.id === id)).filter(Boolean);
  if (found.length === 0) return ids?.length ? { label: ids.join(", "), isEstimate } : undefined;
  const labels = [...new Set(found.map((s) => short(s.name)))];
  const dates = found.map((s) => s.date_taken).filter(Boolean).sort();
  return {
    label: labels.join(" + "),
    date: dates[dates.length - 1],
    url: found[0].url,
    isEstimate,
  };
}

export function normalizeSources(manifest = {}, params = {}) {
  const assumptions = [];
  if (params.domain_discount != null)
    assumptions.push(`Domain discount: ${params.domain_discount}% (AI time-horizons are shortened for office work).`);
  if (params.adoption_delay_years != null)
    assumptions.push(`Adoption delay: ${params.adoption_delay_years} years between "AI can" and "firms do".`);
  return {
    ...manifest,
    snapshotDate: manifest.snapshotDate ?? manifest.snapshot_date,
    model: manifest.model ?? manifest.llm_model_used,
    sources: (manifest.sources ?? []).map((s) => ({
      label: s.label ?? s.name, url: s.url, date: s.date ?? s.date_taken, licence: s.licence,
    })),
    assumptions: manifest.assumptions ?? assumptions,
  };
}

export function normalizeForecast(raw, manifest) {
  const tasks = (raw.tasks ?? []).map((t) => {
    const noData = t.status === "no_data";
    return {
      task_id: t.task_id,
      name: t.name,
      hours: t.hours ?? 0,
      no_data: noData,
      reason: t.reason,
      from: noData ? undefined : Math.floor(t.from),
      to: noData || t.to == null ? null : Math.floor(t.to),
      kind: t.mode === "automate" ? "does" : t.mode === "augment" ? "helps" : null,
      used_with_ai_today: t.used_with_ai_today ?? null,
      is_estimate: t.is_estimate,
      source: resolveSources(t.sources, manifest, t.is_estimate),
    };
  });

  const by_year = {};
  for (const [y, v] of Object.entries(raw.by_year ?? {})) {
    const left = new Set(v.leftover_task_ids ?? []);
    by_year[y] = {
      ai_task_ids: tasks.filter((t) => !left.has(t.task_id) && !t.no_data).map((t) => t.task_id),
      ai_hours: v.hours_ai ?? 0,
      human_hours: (v.hours_total ?? 0) - (v.hours_ai ?? 0),
      no_data_hours: v.hours_no_data ?? 0,
      total_hours: v.hours_total ?? 0,
      share_ai: v.share_ai,
      emerging_role: null, // filled in from /api/match
      is_estimate: v.is_estimate,
    };
  }

  return {
    ...raw,
    tasks,
    by_year,
    skills: [], // the engine doesn't send skill trends yet
    source: resolveSources(raw.scenario?.sources, manifest, raw.scenario?.is_estimate),
  };
}

const roleOut = (r, skillName, manifest) => {
  const named = (ids) => (ids ?? []).map((id) => ({ id, name: skillName(id) }));
  const relatedSet = new Set(r.related_skill_ids ?? []);
  return {
    job_id: r.role_id,
    title: r.name,
    closest_job: r.closest_real_occupation,
    score: r.score,
    breakdown: { tasks: r.parts?.leftover ?? null, skills: r.parts?.skills, outlook: r.parts?.outlook },
    shares_skills: r.shares_skills,
    skills_have: r.have ?? 0,
    skills_related: r.related ?? 0,
    skills_total: r.need ?? 0,
    have: named(r.have_skill_ids),
    // related skills are also in missing_skill_ids; list the plain-missing first
    missing: [
      ...named((r.missing_skill_ids ?? []).filter((id) => !relatedSet.has(id))),
      ...named((r.missing_skill_ids ?? []).filter((id) => relatedSet.has(id))),
    ],
    sdg: (r.sdg ?? []).map((s) => ({
      target: s.target,
      label: goalOf(s.target),
      effect: s.sign === "-" ? -1 : 1,
      reason: clip(s.reason),
      is_estimate: s.is_estimate,
    })),
    is_estimate: r.is_estimate,
    source: resolveSources(r.sources, manifest, r.is_estimate),
  };
};

export function normalizeMatch(raw, manifest, skillName = (id) => id) {
  const by_year = {};
  for (const [y, v] of Object.entries(raw.by_year ?? {})) {
    const e = v.emerging_role;
    by_year[y] = {
      jobs: (v.roles ?? []).map((r) => roleOut(r, skillName, manifest)),
      emerging_role: e && {
        role_id: e.role_id,
        name: e.name,
        closest_job: e.closest_real_occupation,
        note: e.note,
        overlap: e.overlap,
        made_of: [],
        is_estimate: e.is_estimate,
        source: resolveSources(e.sources, manifest, e.is_estimate),
      },
    };
  }
  return { ...raw, by_year };
}

// Route shape isn't final yet, so accept both the CSV-style and the page-style names.
export function normalizeRoute(raw, manifest, skillName = (id) => id) {
  const nm = (x) => (typeof x === "string" ? { id: x, name: skillName(x) } : x);
  const steps = (raw.steps ?? []).map((s, i) => {
    const c = s.course ?? {};
    const hrd = c.hrd_claimable ?? c.hrd_corp_claimable;
    return {
      ...s,
      order: s.order ?? i + 1,
      skill: s.skill?.name ?? (typeof s.skill === "string" ? skillName(s.skill) : s.skill_name ?? skillName(s.skill_id)),
      course: {
        title: c.title ?? c.course_name,
        provider: c.provider,
        hours: c.hours === "" ? null : c.hours,
        stated_duration: c.stated_duration,
        cost: c.cost,
        hrd_claimable: hrd === "unknown" || hrd === "" ? "check" : hrd,
        url: c.url ?? c.link,
        checked: c.checked ?? c.date_checked,
      },
      source: s.source && !s.source.label && Array.isArray(s.source) ? resolveSources(s.source, manifest) : s.source ?? resolveSources([c.source ?? s.source_id].filter(Boolean), manifest),
    };
  });
  return {
    ...raw,
    steps,
    no_course: (raw.no_course ?? []).map(nm),
    stop_investing: (raw.stop_investing ?? []).map(nm),
    sdg: (raw.sdg ?? []).map((s) => ({
      ...s,
      label: s.label ?? goalOf(s.target),
      effect: s.effect ?? (s.sign === "-" ? -1 : 1),
    })),
  };
}