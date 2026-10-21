async function request(path, body) {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText || "Server unreachable");
  }
  return res.json();
}

export const api = {
  profiles: () => request("/api/profiles"),
  forecast: (tasks, scenario) => request("/api/forecast", { tasks, scenario }),
  match: (p) => request("/api/match", p),
  route: (p) => request("/api/route", p),
  sources: () => request("/api/sources"),
  refresh: () => request("/api/refresh", {}),
};