import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import Receipt from "../components/Receipt.jsx";
import SdgTags from "../components/SdgTags.jsx";
import Skeleton from "../components/Skeleton.jsx";
import { personTasks, toPayload } from "../utils.js";
import WordTitle from "../components/WordTitle.jsx";

const HRD = { yes: "Yes", no: "No", check: "Check with provider", true: "Yes", false: "No" };

const duration = (c) =>
  c.hours != null ? `${c.hours} h` : c.stated_duration ?? "duration not stated";

export default function RoutePage() {
  const { person, scenario, year, chosenJob, dataVersion } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!person || !chosenJob) return;
    let ignore = false;
    setError(null);
    api.route({
      jobId: chosenJob.job_id,
      skills: person.skill_ids ?? [],
      tasks: toPayload(personTasks(person)), // so editing the week changes the route too
      scenario,
    })
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
  if (!person || !data) return <Skeleton rows={5} label="Building your route" />;

  const steps = data.steps ?? [];
  const stops = data.stop_investing_by_year?.[year] ?? [];
  const noHours = Array.isArray(data.courses_without_hours) ? data.courses_without_hours.length : data.courses_without_hours ?? 0;
  const tradeoffs = (data.sdg ?? []).filter((s) => s.effect < 0);

  return (
    <>
      <WordTitle text={data.title ?? chosenJob.title} />
      {data.total_weeks != null && (
        <p className="lead muted">
          Total: about {data.total_weeks} weeks, part-time
          {noHours > 0 && ` + ${noHours} course${noHours > 1 ? "s" : ""} with no stated hours`}{" "}
          <span className="badge-est">Estimate</span>
        </p>
      )}

      <ol className="steps">
        {steps.map((s, i) => {
          const c = s.course ?? {};
          return (
            <li key={s.order ?? i} className="card step">
              <div className="step-num">{s.order ?? i + 1}</div>
              <div className="step-body">
                <div className="step-head">
                  <h3>{s.skill}</h3>
                  {s.label_by_year?.[year] && <span className={"tag " + s.label_by_year[year]}>{s.label_by_year[year]}</span>}
                </div>
                {s.note && <p className="muted">{s.note}</p>}
                {s.sdg?.length > 0 && (
                  <div className="sdg-line">
                    {s.sdg.slice(0, 3).map((g) => (
                      <span key={g.target + g.label} className="sdg-item">
                        <span className="pill pill-outline">{g.target} {g.label}</span>
                        <SdgTags s={g} />
                      </span>
                    ))}
                  </div>
                )}
                <div className="course">
                  <div className="course-img" aria-hidden="true">
                    <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 18 24 8l20 10-20 10L4 18Z" /><path d="M12 23v10c0 3 5.4 6 12 6s12-3 12-6V23" /><path d="M44 18v12" />
                    </svg>
                  </div>
                  <div className="course-main">
                    <div className="course-provider">
                      <span className="course-logo" aria-hidden="true">{(c.provider ?? "?").trim().charAt(0).toUpperCase()}</span>
                      <span>{c.provider}</span>
                    </div>
                    {c.url ? (
                      <a className="course-title" href={c.url} target="_blank" rel="noreferrer">{c.title}</a>
                    ) : (
                      <b className="course-title">{c.title}</b>
                    )}
                    <span className="course-meta">{[duration(c), c.cost].filter(Boolean).join(" · ")}</span>
                    <span className="course-meta">
                      HRD Corp claimable: {HRD[c.hrd_claimable] ?? c.hrd_claimable ?? "Not stated"}
                      <Receipt source={s.source}>
                        {c.checked && <span>Date checked: {c.checked}</span>}
                      </Receipt>
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {steps.length === 0 && (
        <p className="muted">We don't have any courses in our list for this job's missing skills yet.</p>
      )}
      {data.no_course?.length > 0 && (
        <p className="no-course">
          <b>No course in our list yet for:</b> {data.no_course.map((x) => (typeof x === "string" ? x : x.name ?? x.skill)).join(", ")}
        </p>
      )}

      {stops.length > 0 && (
        <div className="stop">
          <b>Stop investing in:</b> {stops.map((x) => x.skill).join(", ")}
          <span className="tag trap">trap</span>
          <Receipt source={stops[0].source} />
        </div>
      )}

      {tradeoffs.length > 0 && (
        <p className="muted">
          Trade-off: {tradeoffs.map((s) => `${s.target} ${s.label}`).join(", ")}
        </p>
      )}
    </>
  );
}