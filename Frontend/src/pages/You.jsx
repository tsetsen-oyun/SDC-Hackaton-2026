import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { personTasks } from "../utils.js";
import WeekSplit from "../components/WeekSplit.jsx";
import Receipt from "../components/Receipt.jsx";

const STAT_SOURCE = { label: "ISIS Malaysia & World Bank", date: "2025", isEstimate: false };

export default function You() {
  const { profiles, person, setPerson, setChosenJob } = useApp();
  if (!person) return <p>Loading…</p>;

  const tasks = personTasks(person);
  const hasHours = tasks.some((t) => t.hours > 0);

  function pick(p) {
    setPerson(p);
    setChosenJob(null);
  }

  return (
    <>
      <div className="card stat">
        About <b>45%</b> of Malaysian workers have at least 40% of their tasks that today's AI could do.
        <Receipt source={STAT_SOURCE} />
      </div>

      <h2>Choose a sample person</h2>
      <div className="people">
        {profiles.map((p) => (
          <button key={p.id ?? p.name} className={"person" + (p === person ? " on" : "")} onClick={() => pick(p)}>
            <b>{p.name}</b>
            <span>{p.title}</span>
          </button>
        ))}
      </div>

      <section className="card week">
        {hasHours ? (
          // list on the left, pastel pie on the right
          <WeekSplit person={person} />
        ) : (
          // no hours (a job the person hasn't started): just the task list
          <>
            <h2>Tasks in {person.target_job ?? "the target job"}</h2>
            <div>
              {tasks.map((t) => (
                <div key={t.task_id} className="simple-row">
                  <span>{t.name}</span>
                  <span>–</span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <Link to="/forecast" className="btn-blue">See my forecast →</Link>
    </>
  );
}