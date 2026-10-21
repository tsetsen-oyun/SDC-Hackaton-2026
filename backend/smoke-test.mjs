const BASE = process.env.BASE || "http://localhost:3000";
let failed = 0;

async function call(path, body) {
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "   " + detail}`);
  if (!ok) failed++;
}

const { json: raw } = await call("/api/profiles");
const people = Array.isArray(raw) ? raw : Object.values(raw ?? {});
check("profiles returns people", people.length > 0, JSON.stringify(raw)?.slice(0, 100));

const p = people.find((x) => x.tasks?.length) ?? people[0];
const tasks = (p.tasks?.length ? p.tasks : p.target_job_tasks).map(({ task_id, hours }) => ({ task_id, hours }));
const skills = p.skill_ids ?? [];
let jobId;

for (const scenario of ["moderate", "fast", "slowdown"]) {
  const f = await call("/api/forecast", { tasks, scenario });
  check(`forecast ${scenario}: 200`, f.status === 200, JSON.stringify(f.json)?.slice(0, 120));
  check(`forecast ${scenario}: has by_year[2029]`, !!f.json?.by_year?.[2029]);

  for (const mode of ["market", "marketPlanet"]) {
    const m = await call("/api/match", { tasks, skills, scenario, mode });
    const jobs = m.json?.by_year?.[2029]?.jobs;
    check(`match ${scenario}/${mode}: 200 + jobs`, m.status === 200 && Array.isArray(jobs) && jobs.length > 0,
      JSON.stringify(m.json)?.slice(0, 120));
    jobId ??= jobs?.[0]?.job_id;
  }
}

const r = await call("/api/route", { jobId, skills, scenario: "moderate" });
check("route: 200 + steps", r.status === 200 && r.json?.steps?.length > 0, JSON.stringify(r.json)?.slice(0, 120));

const bad = await call("/api/forecast", { tasks, scenario: "normal" });
check("forecast rejects scenario 'normal' (400)", bad.status === 400);

const s = await call("/api/sources");
check("sources: has a snapshot date", !!(s.json?.snapshotDate ?? s.json?.snapshot_date), JSON.stringify(s.json)?.slice(0, 120));

// last, because it changes the server's data date
const rf = await call("/api/refresh", {});
check("refresh: 200 + new date", rf.status === 200 && !!(rf.json?.snapshotDate ?? rf.json?.snapshot_date),
  JSON.stringify(rf.json)?.slice(0, 120));

console.log(failed ? `\n${failed} check(s) failed` : "\nAll good");
process.exit(failed ? 1 : 0);