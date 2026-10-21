import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import Receipt from "../components/Receipt.jsx";

const HRD = { yes: "Yes", no: "No", check: "Check with provider" };

export default function RoutePage() {
  const { person, scenario, chosenJob, dataVersion } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!person || !chosenJob) return;
    let ignore = false;
    setError(null);
    api.route({ jobId: chosenJob.job_id, skills: person.skill_ids ?? [], scenario })
      .then((d) => { if (!ignore) setData(d); })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [person, chosenJob, scenario, dataVersion]);

  if (!chosenJob)
    return (
      <div className="card empty">
        <p>Pick a job on the Map first, then your route shows up here.</p>
        <Link to="/map" className="btn-blue">Go to Map →</Link>
      </div>
    );
  if (error) return <p>Couldn't load the route: {error}</p>;
  if (!person || !data) return <p>Loading…</p>;

  const supports = data.sdg.filter((s) => s.effect > 0);
  const tradeoffs = data.sdg.filter((s) => s.effect < 0);

  return (
    <>
      <p className="eyebrow">{person.name}'s route to</p>
      <h1 className="hero">{data.title ?? chosenJob.title}</h1>
      <p className="lead muted">
        Total: about {data.total_weeks} weeks, part-time <span className="badge-est">Estimate</span>
      </p>

      <ol className="steps">
        {data.steps.map((s) => (
          <li key={s.order} className="card step">
            <div className="step-num">{s.order}</div>
            <div className="step-body">
              <div className="step-head">
                <h3>{s.skill}</h3>
                <span className={"tag " + s.label}>{s.label}</span>
              </div>
              {s.note && <p className="muted">{s.note}</p>}
              <div className="course">
                <b>{s.course.title}</b>
                <span>{s.course.provider} · {s.course.hours} h · {s.course.cost}</span>
                <span>
                  HRD Corp claimable: {HRD[s.course.hrd_claimable] ?? s.course.hrd_claimable}
                  <Receipt source={s.source}>
                    <span>Date checked: {s.course.checked}</span>
                  </Receipt>
                </span>
                {s.course.url && <a href={s.course.url} target="_blank" rel="noreferrer">Open course</a>}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {data.stop_investing?.length > 0 && (
        <div className="stop">
          <b>Stop investing in:</b>
          {data.stop_investing.map((x) => x.skill).join(", ")}
          <span className="tag trap">trap</span>
          <Receipt source={data.stop_investing[0].source} />
        </div>
      )}

      <div className="sdg-line">
        <span className="muted">This path supports:</span>
        {supports.map((s) => (
          <span key={s.target + s.label} className="pill pill-outline">{s.target} {s.label}</span>
        ))}
      </div>
      {tradeoffs.length > 0 && (
        <p className="muted">
          Trade-off: {tradeoffs.map((s) => `${s.target} ${s.label}`).join(", ")}
        </p>
      )}
    </>
  );
}