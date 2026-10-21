import { normalizeSources } from "./adapters.js";

// One place that talks to the server. Errors come back as { error: "..." } (400 / 500 / 501).
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

export const api = {
  profiles: () => request("/api/profiles"),
  forecast: (tasks, scenario) => request("/api/forecast", { tasks, scenario }),
  match: (p) => request("/api/match", p),
  route: (p) => request("/api/route", p),
  mentor: (p) => request("/api/mentor", p),
  tasks: () => request("/api/tasks"),
  refresh: () => request("/api/refresh", {}),
  async sources() {
    const res = await request("/api/sources");
    return normalizeSources(res, res.params);
  },
};