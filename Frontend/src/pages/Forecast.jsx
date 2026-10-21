import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import { personTasks, toPayload, rangeLabel, SCENARIO_LABEL } from "../utils.js";
import WeekBar from "../components/WeekBar.jsx";
import Receipt from "../components/Receipt.jsx";

const FIRST = 2026, LAST = 2035;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
const pos = (y) => Math.min(100, Math.max(0, ((y - FIRST) / (LAST - FIRST)) * 100));

const KIND = { does: ["AI does it", "pill-solid"], helps: ["AI helps", "pill-outline"] };
// the engine sent no "mode" for this task, so we say so instead of leaving the cell empty
const NO_KIND = ["Not specified", "pill-muted"];

function TaskRow({ t, year, done, showHours }) {
  const kind = KIND[t.kind] ?? NO_KIND;
  const end = t.to ?? LAST;
  return (
    <div className={"trow " + (done ? "done" : "human")}>
      <div className="tname">
        <span className={"check " + (done ? "hatched" : "human")} />
        {t.name}
      </div>
      <div className="hours">{showHours ? t.hours : "–"}</div>
      <div className="range">
        {t.no_data ? (
          <div className="range-label no-data">
            No data <Receipt source={t.source} />
          </div>
        ) : (
          <>
            <div className="range-track" />
            <div
              className={"range-bar" + (done ? "" : " human") + (t.to == null ? " open" : "")}
              style={{ left: pos(t.from) + "%", width: Math.max(pos(end) - pos(t.from), 3) + "%" }}
            />
            <div className="range-tick" style={{ left: pos(year) + "%" }} />
            <div className="range-label">
              {rangeLabel(t.from, t.to)}
              <Receipt source={t.source} />
            </div>
          </>
        )}
      </div>
      <div>{kind && <span className={"pill " + kind[1]}>{kind[0]}</span>}</div>
    </div>
  );
}

export default function Forecast() {
  const { person, scenario, year, setYear, dataVersion } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!person) return;
    let ignore = false; // stops an old, slow response from overwriting a newer one
    setError(null);
    api.forecast(toPayload(personTasks(person)), scenario, person.skill_ids ?? [])
      .then((d) => { if (!ignore) setData(d); })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [person, scenario, dataVersion]);

  if (error) return <p>Couldn't load the forecast: {error}</p>;
  if (!person || !data) return <p>Loading…</p>;

  const yearData = data.by_year[year];
  if (!yearData) return <p>No forecast for {year}.</p>;

  const doneIds = new Set(yearData.ai_task_ids);
  const hasHours = data.tasks.some((t) => t.hours > 0);
  const totalHours = data.tasks.reduce((s, t) => s + t.hours, 0);
  const byId = Object.fromEntries(data.tasks.map((t) => [t.task_id, t]));
  const role = yearData.emerging_role;

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">
            {person.name} · {person.title}
            {hasHours && ` · ${totalHours} hours a week`}
          </p>
          <h1 className="hero">
            {hasHours ? `${person.name}'s week in ` : `${person.target_job ?? "This job"} in `}
            <span className="accent">{year}</span>
          </h1>
        </div>
        <div
          className="year-slider glass-widget"
          style={{ "--fill": ((year - FIRST) / (LAST - FIRST)) * 100 + "%" }}
        >
          <div className="year-head">
            <span className="mono">Year</span>
            <b>{year}</b>
          </div>
          <input
            type="range" min={FIRST} max={LAST} step="1" value={year}
            aria-label="Year"
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <div className="year-labels">
            {YEARS.map((y) => (
              <span key={y} className={y === year ? "on" : ""}>
                {y === FIRST || y === LAST ? y : String(y).slice(2)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {hasHours ? (
        <section className="card week">
          <div className="week-head">
            <div className="legend">
              <div>
                <small><span className="swatch hatched" /> AI could do this <Receipt source={data.source} /></small>
                <div className="big-num">{yearData.ai_hours} h</div>
              </div>
              <div>
                <small><span className="swatch blue" /> Still human</small>
                <div className="big-num blue">{yearData.human_hours} h</div>
              </div>
            </div>
            <p className="week-note">
              By {year}, AI could do about <b>{Math.round(yearData.share_ai * 100)}% of {person.name}'s weekly hours</b>{" "}
              under the {SCENARIO_LABEL[scenario]} scenario. <b>Estimate.</b>
              {yearData.no_data_hours > 0 &&
                ` ${yearData.no_data_hours} h have no published timing, so we count them as still human.`}
            </p>
          </div>
          <WeekBar tasks={data.tasks} doneIds={doneIds} />
        </section>
      ) : (
        <section className="card week">
          <p className="week-note">
            {person.name} hasn't started this job yet, so we show its tasks and when AI could do each one.
            There are no hours because there's no week to measure.
          </p>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="table-head">
            <h2>{person.name}'s tasks</h2>
            <span className="muted">Sorted by when AI could do them</span>
          </div>
          <div className="trow header">
            <span>Task</span>
            <span className="hours">Hours</span>
            <div className="range-head">
              <span>{FIRST}</span>
              <b style={{ left: pos(year) + "%" }}>{year}</b>
              <span>{LAST}+</span>
            </div>
            <span>Type</span>
          </div>
          {data.tasks.map((t) => (
            <TaskRow key={t.task_id} t={t} year={year} done={doneIds.has(t.task_id)} showHours={hasHours} />
          ))}
          <p className="table-foot">
            All dates are estimates. Each range shows how unsure we are under the chosen scenario.
            A task counts as “AI could do this” once {year} passes the middle of its range.
          </p>
        </section>

        <div className="stack">
          {role ? (
            <section className="card-dark role">
              <div className="role-top">
                <span>What's left: a new role forming</span>
                {role.is_estimate && <span className="badge-est">Estimate</span>}
              </div>
              <h2>{role.name}</h2>
              <div className="made">Made of</div>
              <div className="chips">
                {(role.made_of ?? []).map((id) =>
                  byId[id] ? (
                    <span key={id} className="chip">
                      {byId[id].name}{hasHours && ` · ${byId[id].hours} h`}
                    </span>
                  ) : null
                )}
              </div>
              {role.closest_job && (
                <div className="role-sep">
                  Closest real job <b>{role.closest_job}</b>
                  <Receipt source={role.source} />
                </div>
              )}
              <Link to="/map" className="btn-orange">See matching roles on Map →</Link>
            </section>
          ) : (
            <section className="card role-empty">
              <b>No new role forming yet in {year}</b>
              <p className="muted">Drag the year forward to see what's left of the week.</p>
            </section>
          )}

          {data.skills?.length > 0 && (
            <section className="card skills">
              <h2>{person.name}'s skills</h2>
              {data.skills.map((s) => (
                <div key={s.id} className={"skill " + (s.label ?? "")}>
                  <span className="skill-bar" />
                  <div className="skill-main">
                    <div className="skill-name">{s.name}</div>
                    <div className="skill-trend">{s.trend}</div>
                  </div>
                  {s.label && <span className="tag">{s.label}</span>}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}