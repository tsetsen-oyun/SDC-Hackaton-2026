
import "dotenv/config";
import express from "express";

const engine = await import(
  process.env.USE_MOCK ? "./mock/engine.js" : "./engine/index.js"
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

app.use(express.json());

app.get("/", (req, res) =>
  res.json({ message: "Backend is working!" })
);

app.get(
  "/api/profiles",
  needs("getProfiles"),
  wrap(async (req, res) => {
    res.json(await engine.getProfiles());
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
    const { tasks, skills, scenario, mode } = req.body;

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

    res.json(await engine.match({ tasks, skills, scenario, mode }));
  })
);

app.post(
  "/api/route",
  needs("buildRoute"),
  wrap(async (req, res) => {
    const { jobId, skills, scenario } = req.body;

    if (!jobId || !Array.isArray(skills) || !SCENARIOS.includes(scenario))
      return bad(res, "Need jobId, skills[], scenario");

    res.json(await engine.buildRoute({ jobId, skills, scenario }));
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
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
