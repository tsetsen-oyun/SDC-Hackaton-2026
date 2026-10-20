import "dotenv/config";
import express from "express";
import { forecast, match, buildRoute, getSources, refreshData } from "./src/logic/index.js";
import profiles from "./src/data/profiles.json" with { type: "json" };

const SCENARIOS = ["normal", "fast", "slowdown"];
const MODES = ["market", "marketPlanet"];
const bad = (res, msg) => res.status(400).json({ error: msg });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend is working!" });
});

app.get("/api/profiles", (req, res) => {
  res.json(profiles);
});

app.post("/api/forecast", (req, res) => {
  const { tasks, scenario } = req.body;

  if (!Array.isArray(tasks) || !SCENARIOS.includes(scenario))
    return bad(res, "Need tasks[] and scenario: normal | fast | slowdown");

  res.json(forecast(tasks, scenario));
});

app.post("/api/match", (req, res) => {
  const { tasks, skills, scenario, mode } = req.body;

  if (!Array.isArray(tasks) || !Array.isArray(skills) || !SCENARIOS.includes(scenario) || !MODES.includes(mode))
    return bad(res, "Need tasks[], skills[], scenario, mode: market | marketPlanet");

  res.json(match({ tasks, skills, scenario, mode }));
});

app.post("/api/route", (req, res) => {
  const { jobId, skills, scenario } = req.body;

  if (!jobId || !Array.isArray(skills) || !SCENARIOS.includes(scenario))
    return bad(res, "Need jobId, skills[], scenario");

  res.json(buildRoute({ jobId, skills, scenario }));
});

app.get("/api/sources", (req, res) => {
  res.json(getSources());
});

app.post("/api/refresh", async (req, res) => {
  res.json(await refreshData());
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});