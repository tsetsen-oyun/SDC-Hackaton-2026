
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const engine = await import(
  process.env.USE_MOCK ? "./mock/engine.js" : "./engine/pages.js"
);

const SCENARIOS = ["moderate", "fast", "slowdown"];
const MODES = ["market", "marketPlanet"];

const bad = (res, msg) => res.status(400).json({ error: msg });

const validTasks = (t) =>
  Array.isArray(t) &&
  t.every((x) => x && x.task_id != null && typeof x.hours === "number");

// Answers 501 if the engine doesn't have this function yet
const needs = (name) => (req, res, next) =>
  typeof engine[name] === "function"
    ? next()
    : res.status(501).json({
        error: `engine.${name} is not implemented yet`,
      });

// Sends errors to the error handler instead of hanging
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const app = express();
const PORT = process.env.PORT || 3000;
// One proxy (Replit, Render...) sits in front of us, so req.ip is the visitor, not the proxy. Used to rate-limit /api/intake.
app.set("trust proxy", 1);

app.use(express.json());

app.get(
  "/api/profiles",
  needs("getProfiles"),
  wrap(async (req, res) => {
    res.json(await engine.getProfiles());
  })
);

app.get(
  "/api/tasks",
  needs("getTasks"),
  wrap(async (req, res) => {
    res.json(await engine.getTasks());
  })
);

app.post(
  "/api/forecast",
  needs("forecast"),
  wrap(async (req, res) => {
    const { tasks, scenario } = req.body;

    if (!validTasks(tasks) || !SCENARIOS.includes(scenario))
      return bad(
        res,
        "Need tasks[{task_id, hours}] and scenario: moderate | fast | slowdown"
      );

    res.json(await engine.forecast(tasks, scenario));
  })
);

app.post(
  "/api/match",
  needs("match"),
  wrap(async (req, res) => {
    const { tasks, skills, scenario, mode, targetJob } = req.body;

    if (
      !validTasks(tasks) ||
      !Array.isArray(skills) ||
      !SCENARIOS.includes(scenario) ||
      !MODES.includes(mode)
    )
      return bad(
        res,
        "Need tasks[], skills[], scenario, mode: market | marketPlanet"
      );

    res.json(await engine.match({ tasks, skills, scenario, mode, targetJob }));
  })
);

app.post(
  "/api/route",
  needs("buildRoute"),
  wrap(async (req, res) => {
    const { jobId, skills, tasks = [], scenario } = req.body;

    if (!jobId || !Array.isArray(skills) || !Array.isArray(tasks) || !SCENARIOS.includes(scenario))
      return bad(res, "Need jobId, skills[], scenario (tasks[] optional)");

    res.json(await engine.buildRoute({ jobId, skills, tasks, scenario }));
  })
);

app.post(
  "/api/mentor",
  needs("mentor"),
  wrap(async (req, res) => {
    const { tasks, skills, scenario, userId } = req.body;

    if (!validTasks(tasks) || !Array.isArray(skills) || !SCENARIOS.includes(scenario))
      return bad(res, "Need tasks[], skills[], scenario, userId");

    res.json(await engine.mentor({ tasks, skills, scenario, userId }));
  })
);

app.post(
  "/api/intake",
  needs("intake"),
  wrap(async (req, res) => {
    const { text } = req.body ?? {};
    if (typeof text !== "string") return bad(res, "Need text: a string describing your work");
    res.json(await engine.intake({ text, visitor: req.ip }));
  })
);

app.get(
  "/api/sources",
  needs("getSources"),
  wrap(async (req, res) => {
    res.json(await engine.getSources());
  })
);

app.post(
  "/api/refresh",
  needs("refreshData"),
  wrap(async (req, res) => {
    res.json(await engine.refreshData());
  })
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: err.message });
});

// backend/server.js — add next to the other routes (uses engine.getSkills if the teammate adds it)
app.get("/api/skills", needs("getSkills"), wrap(async (_req, res) => res.json(await engine.getSkills())));

// One-server mode: if the frontend has been built (npm run build), serve it from here.
// Same origin as /api, so no CORS. Without a build (npm run dev), Vite serves the pages instead.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../frontend/dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  // BrowserRouter paths like /forecast must open the app, not "Cannot GET". Unknown /api paths stay 404.
  app.use((req, res, next) =>
    req.method === "GET" && !req.path.startsWith("/api")
      ? res.sendFile(path.join(dist, "index.html"))
      : next()
  );
}

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
