import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import { personTasks, toPayload, SCENARIO_LABEL } from "../utils.js";
import Receipt from "../components/Receipt.jsx";

const YEARS = Array.from({ length: 10 }, (_, i) => 2026 + i);
const WEATHER = { rising: "☀️ Rising", steady: "⛅ Steady", declining: "🌧️ Declining" };

function RankShift({ job }) {
  const d = job.rank_market - job.rank_planet; // positive = moves up when the planet counts
  if (d === 0) return <span className="shift same">–</span>;
  return (
    <span className={"shift " + (d > 0 ? "up" : "down")}>
      {d > 0 ? "▲" : "▼"}{Math.abs(d)}
    </span>
  );
}

function JobCard({ job, rank, mode, onChoose }) {
  const pct = Math.round((job.skills_have / job.skills_total) * 100);
  return (
    <article className="card job">
      <div className="job-top">
        <h3>{rank}. {job.title}</h3>
        {job.is_estimate && <span className="badge-est">Estimate</span>}
        {mode === "marketPlanet" && <RankShift job={job} />}
        <div className="job-score">
          Match <b>{job.score}</b>
          <Receipt source={job.source}>
            <span>Tasks you already do: {job.breakdown.tasks}</span>
            <span>Skills you have: {job.breakdown.skills}</span>
            <span>Job outlook: {job.breakdown.outlook}</span>
          </Receipt>
        </div>
      </div>

      <div className="job-meta">
        <span className="outlook">{WEATHER[job.outlook_trend] ?? job.outlook_trend}</span>
        <span>You have <b>{job.skills_have} of {job.skills_total}</b> skills</span>
      </div>
      <div className="meter"><span style={{ width: pct + "%" }} /></div>

      {job.missing.length > 0 && (
        <p className="missing"><span className="muted">Missing:</span> {job.missing.join(", ")}</p>
      )}

      <ul className="sdg-list">
        {job.sdg.map((s) => (
          <li key={s.target + s.label} className={s.effect < 0 ? "debit" : "credit"}>
            <b>{s.effect < 0 ? "−" : "+"} {s.target}</b> {s.label}
            {s.reason && ` · ${s.reason}`}
          </li>
        ))}
      </ul>

      <button className="btn-blue" onClick={() => onChoose(job)}>See my route →</button>
    </article>
  );
}

export default function MapPage() {
  const { person, scenario, year, setYear, setChosenJob, dataVersion } = useApp();
  const [mode, setMode] = useState("market"); // only this page needs it, so it stays local
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!person) return;
    let ignore = false;
    setError(null);
    api.match({
      tasks: toPayload(personTasks(person)),
      skills: person.skill_ids ?? [],
      scenario,
      mode,
    })
      .then((d) => { if (!ignore) setData(d); })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [person, scenario, mode, dataVersion]);

  if (error) return <p>Couldn't load matches: {error}</p>;
  if (!person || !data) return <p>Loading…</p>;

  const jobs = data.by_year[year].jobs;

  function choose(job) {
    setChosenJob(job);
    navigate("/route");
  }

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">{person.name} · {SCENARIO_LABEL[scenario]} scenario</p>
          <h1 className="hero">Future jobs that fit {person.name}</h1>
        </div>
        <div className="map-controls">
          <label className="muted">
            Year
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div className="segmented">
            <button className={mode === "market" ? "on" : ""} onClick={() => setMode("market")}>Market only</button>
            <button className={mode === "marketPlanet" ? "on" : ""} onClick={() => setMode("marketPlanet")}>Market + planet</button>
          </div>
        </div>
      </div>

      <p className="muted note">
        {mode === "marketPlanet"
          ? "Ranked by market fit plus how much each job helps or hurts the SDGs. Arrows show the move compared with the market-only ranking."
          : "Ranked by how well each job fits your tasks, skills and outlook."}{" "}
        These are suggestions to help you decide. You make the final call.
      </p>

      <div className="jobs">
        {jobs.map((job, i) => (
          <JobCard key={job.job_id} job={job} rank={i + 1} mode={mode} onChoose={choose} />
        ))}
      </div>
    </>
  );
}