import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import { personTasks, toPayload, SCENARIO_LABEL, skillName } from "../utils.js";
import Receipt from "../components/Receipt.jsx";
import SdgTags from "../components/SdgTags.jsx";
import MentorCard from "../components/MentorCard.jsx";

const YEARS = Array.from({ length: 10 }, (_, i) => 2026 + i);
const WEATHER = { rising: "☀️ Rising", steady: "⛅ Steady", declining: "🌧️ Declining" };
const OUTLOOK_HINT = {
  declining: "AI could do more of this job's tasks within 2 years.",
  steady: "AI isn't expected to take over more of this job's tasks within 2 years.",
};
const SHOW_MISSING = 5;

function RankShift({ job }) {
  if (job.rank_market == null || job.rank_planet == null) return null;
  const d = job.rank_market - job.rank_planet; // positive = moves up when the planet counts
  if (d === 0) return <span className="shift same">–</span>;
  return (
    <span className={"shift " + (d > 0 ? "up" : "down")}>
      {d > 0 ? "▲" : "▼"}{Math.abs(d)}
    </span>
  );
}

function JobCard({ job, rank, mode, onChoose, was }) {
  const [showAll, setShowAll] = useState(false);
  const total = job.skills_total || 1; // avoids dividing by zero
  const have = job.skills_have ?? 0;
  const related = job.skills_related ?? 0;
  const pctHave = Math.round((have / total) * 100);
  const pctRelated = Math.min(100 - pctHave, Math.round((related / total) * 100));
  const missing = job.missing ?? [];
  const shown = showAll ? missing : missing.slice(0, SHOW_MISSING);
  const hint = OUTLOOK_HINT[job.outlook_trend];
  const b = job.breakdown ?? {};

  return (
    <article className="card job">
      <div className="job-top">
        <h3>{rank}. {job.title}</h3>
        {job.is_target && <span className="target-tag">Your target</span>}
        {was != null && was !== rank && (
          <span className={"moved " + (was > rank ? "up" : "down")} title="Compared with before the data refresh">
            {was > rank ? "▲" : "▼"} was #{was}
          </span>
        )}
        {job.is_estimate && <span className="badge-est">Estimate</span>}
        {mode === "marketPlanet" && <RankShift job={job} />}
        <div className="job-score">
          Match <b>{job.score}</b>
          <Receipt source={job.source}>
            {b.tasks != null && <span>Fits what's left of your week: {b.tasks}</span>}
            <span>Skills you have: {b.skills}</span>
            <span>Job outlook: {b.outlook}</span>
          </Receipt>
        </div>
      </div>

      <div className="job-meta">
        <span className="outlook">{WEATHER[job.outlook_trend] ?? job.outlook_trend}</span>
        {hint && <Receipt>{hint}</Receipt>}
        <span>
          You have <b>{have} of {job.skills_total}</b> skills
          {related > 0 && ` · ${related} related`}
        </span>
      </div>
      <div className="meter">
        <span className="have" style={{ width: pctHave + "%" }} />
        <span className="related" style={{ width: pctRelated + "%" }} />
      </div>

      {missing.length > 0 && (
        <p className="missing">
          <span className="muted">Missing:</span> {shown.map(skillName).join(", ")}{" "}
          {missing.length > SHOW_MISSING && (
            <button className="link-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? "show less" : `+${missing.length - SHOW_MISSING} more`}
            </button>
          )}
        </p>
      )}

      <ul className="sdg-list">
        {(job.sdg ?? []).map((s) => (
          <li key={s.target + s.label} className={s.effect < 0 ? "debit" : "credit"}>
            <b>{s.effect < 0 ? "−" : "+"} {s.target}</b> {s.label}
            {s.reason && <span className="clamp"> · {s.reason}</span>}{" "}
            <SdgTags s={s} />
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
  const [before, setBefore] = useState(null); // the ranking from just before the last data refresh
  const [error, setError] = useState(null);
  const last = useRef({ key: null, version: null, data: null });
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
      targetJob: person.target_job_id, // lets the Map show a person's own target job
    })
      .then((d) => {
        if (ignore) return;
        // same person, scenario and mode but newer data = a refresh happened: keep the old ranking to compare
        const key = `${person.id ?? person.name}|${scenario}|${mode}`;
        const l = last.current;
        const refreshed = l.key === key && l.version !== dataVersion && l.data;
        setBefore(refreshed ? l.data : key === l.key ? before : null);
        last.current = { key, version: dataVersion, data: d };
        setData(d);
      })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [person, scenario, mode, dataVersion]);

  if (error) return <p>Couldn't load matches: {error}</p>;
  if (!person || !data) return <p>Loading…</p>;

  const jobs = data.by_year[year]?.jobs ?? [];
  // job_id -> rank before the refresh, for the year on screen
  const oldRank = Object.fromEntries((before?.by_year?.[year]?.jobs ?? []).map((j, i) => [j.job_id, i + 1]));
  const moves = jobs
    .map((j, i) => ({ title: j.title, now: i + 1, was: oldRank[j.job_id] }))
    .filter((m) => m.was != null && m.was !== m.now);

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

      {before && (
        <div className="refresh-banner" role="status">
          <b>Data refreshed.</b>{" "}
          {moves.length === 0
            ? "The ranking for this year didn't change."
            : `${moves.length} job${moves.length > 1 ? "s" : ""} moved: ${moves
                .slice(0, 3)
                .map((m) => `${m.title} #${m.was} → #${m.now}`)
                .join(", ")}${moves.length > 3 ? ` and ${moves.length - 3} more` : ""}.`}
          <button className="link-btn" onClick={() => setBefore(null)}>Dismiss</button>
        </div>
      )}

      <MentorCard person={person} scenario={scenario} year={year} dataVersion={dataVersion} />

      <div className="jobs">
        {jobs.map((job, i) => {
          const firstNoShare =
            job.shares_skills === false && (i === 0 || jobs[i - 1].shares_skills !== false);
          return (
            <Fragment key={job.job_id}>
              {firstNoShare && <h2 className="group-title">No shared skills yet</h2>}
              <JobCard job={job} rank={i + 1} mode={mode} onChoose={choose} was={oldRank[job.job_id]} />
            </Fragment>
          );
        })}
      </div>
    </>
  );
}