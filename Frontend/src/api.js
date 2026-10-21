import { normalizeForecast, normalizeMatch, normalizeRoute, normalizeSources } from "./adapters.js";

async function request(path, body) {
  const res = await fetch(path, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || "Server unreachable");
  }
  return res.json();
}

// Manifest (source ids -> names/dates/links) and skill names are fetched once and reused.
// `refresh()` clears them so a new snapshot is picked up.
let manifestP = null;
let skillsP = null;
const getManifest = () => (manifestP ??= request("/api/sources").catch((e) => { manifestP = null; throw e; }));
const getSkillName = async () => {
  skillsP ??= request("/api/skills")
    .then((res) => {
      const rows = Array.isArray(res) ? res : Object.values(res);
      return Object.fromEntries(rows.map((r) => [r.skill_id ?? r.id, r.skill_name ?? r.name]));
    })
    .catch(() => ({})); // endpoint missing -> we show a short id instead of crashing
  const map = await skillsP;
  return (id) => map[id] ?? `skill ${String(id).replace("SK_", "")}`;
};

export const api = {
  profiles: () => request("/api/profiles"),

  async forecast(tasks, scenario, skills) {
    const manifest = await getManifest().catch(() => ({}));
    const raw = await request("/api/forecast", { tasks, scenario });
    const data = normalizeForecast(raw, manifest);
    if (skills) {
      // the "new role forming" card comes from the match engine
      try {
        const m = await request("/api/match", { tasks, skills, scenario, mode: "market" });
        const nm = normalizeMatch(m, manifest);
        for (const [y, v] of Object.entries(nm.by_year))
          if (data.by_year[y]) data.by_year[y].emerging_role = v.emerging_role;
      } catch { /* role card falls back to "no new role yet" */ }
    }
    return data;
  },

  async match(p) {
    const [manifest, skillName] = await Promise.all([getManifest().catch(() => ({})), getSkillName()]);
    return normalizeMatch(await request("/api/match", p), manifest, skillName);
  },

  async route(p) {
    const [manifest, skillName] = await Promise.all([getManifest().catch(() => ({})), getSkillName()]);
    return normalizeRoute(await request("/api/route", p), manifest, skillName);
  },

  async sources() {
    return normalizeSources(await getManifest());
  },

  async refresh() {
    const res = await request("/api/refresh", {});
    manifestP = null;
    skillsP = null;
    return res;
  },
};