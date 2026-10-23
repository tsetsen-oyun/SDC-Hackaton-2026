import { useEffect, useState } from "react";
import { api } from "../api.js";
import { personTasks, toPayload } from "../utils.js";
import Receipt from "./Receipt.jsx";

const nm = (x) => (typeof x === "string" ? x : x?.name ?? x?.skill_name ?? String(x));

function Chips({ label, list = [] }) {
  const more = list.length - 3;
  return (
    <div className="m-col">
      <span className="m-label">{label}</span>
      <div className="m-chips">
        {list.slice(0, 3).map((x) => <span key={nm(x)} className="m-chip">{nm(x)}</span>)}
        {list.length === 0 && <span className="muted">–</span>}
        {more > 0 && <span className="m-chip more">+{more} more</span>}
      </div>
    </div>
  );
}

// "Someone who could swap skills with you" — only shown when the engine says it is possible
export default function MentorCard({ person, scenario, year, dataVersion }) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    if (!person) return;
    let ignore = false;
    api.mentor({
      tasks: toPayload(personTasks(person)),
      skills: person.skill_ids ?? [],
      scenario,
      userId: person.id,
    })
      .then((d) => { if (!ignore) setRes(d); })
      .catch(() => { if (!ignore) setRes(null); }); // the card is a bonus, so a failure just hides it
    return () => { ignore = true; };
  }, [person, scenario, dataVersion]);

  const pairs = (Array.isArray(res) ? res : res?.pairs ?? res?.mentors ?? [])
    .map((p) => ({ p, y: p.by_year?.[year] }))
    .filter(({ y }) => y?.possible);
  if (pairs.length === 0) return null;
  const consent = res?.consent_note ?? pairs[0].p.consent_note;

  return (
    <section className="card mentor">
      <div className="mentor-head">
        <h2>People you could swap skills with</h2>
        <span className="m-badge">Suggestion</span>
      </div>
      {pairs.map(({ p, y }) => (
        <div key={p.with_name} className="mentor-pair">
          <div className="m-who">
            <span className="m-avatar">{String(p.with_name).charAt(0)}</span>
            <b>{p.with_name}</b>
            {p.you_are && <span className="m-role">you are the {p.you_are}</span>}
            <Receipt source={p.source} />
          </div>
          <div className="m-cols">
            <Chips label="You bring" list={y.you_bring} />
            <Chips label="They bring" list={y.they_bring} />
          </div>
          {y.senior_next_job && (
            <div className="m-next">
              <span className="m-label">{p.you_are === "senior" ? "Your next job could be" : "Their next job could be"}</span>
              <b>{y.senior_next_job}</b>
            </div>
          )}
        </div>
      ))}
      {consent && (
        <p className="consent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
          <span>{consent}</span>
        </p>
      )}
    </section>
  );
}