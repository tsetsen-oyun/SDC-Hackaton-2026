import { useEffect, useState } from "react";
import { api } from "../api.js";
import { personTasks, toPayload } from "../utils.js";
import Receipt from "./Receipt.jsx";

const nm = (x) => (typeof x === "string" ? x : x?.name ?? x?.skill_name ?? String(x));

function Skills({ label, list = [] }) {
  const shown = list.slice(0, 3).map(nm).join(", ");
  const more = list.length - 3;
  return (
    <p>
      <span className="muted">{label}:</span> {shown || "–"}
      {more > 0 && <span className="muted"> and {more} more</span>}
    </p>
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
      <h2>People you could swap skills with</h2>
      {pairs.map(({ p, y }) => (
        <div key={p.with_name} className="mentor-pair">
          <b>{p.with_name}</b> {p.you_are && <span className="muted">· you are the {p.you_are}</span>}
          <Receipt source={p.source} />
          <Skills label="You bring" list={y.you_bring} />
          <Skills label="They bring" list={y.they_bring} />
          {y.senior_next_job && <p className="muted">Their next job could be: {y.senior_next_job}</p>}
        </div>
      ))}
      {consent && <p className="consent">{consent}</p>}
    </section>
  );
}