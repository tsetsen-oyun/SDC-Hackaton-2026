import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { personTasks } from "../utils.js";
import WeekSplit from "../components/WeekSplit.jsx";
import Receipt from "../components/Receipt.jsx";
import { api } from "../api.js";

const STAT_SOURCE = { label: "ISIS Malaysia & World Bank", date: "2025", isEstimate: false };

export default function You() {
  const { profiles, person, setPerson, setChosenJob } = useApp();
  const [adding, setAdding] = useState("");
  const [catalogue, setCatalogue] = useState([]); // every task we know, for "add a task"
  useEffect(() => {
    api.tasks().then((r) => setCatalogue(Array.isArray(r) ? r : r.tasks ?? [])).catch(() => setCatalogue([]));
  }, []);
  if (!person) return <p>Loading…</p>;

  const tasks = personTasks(person);
  const hasHours = tasks.some((t) => t.hours > 0);

  // editing = making a new copy of the person with different tasks; the forecast etc. re-run by themselves
  const setTasks = (next) => setPerson({ ...person, tasks: next });
  const setHours = (id, h) => setTasks(tasks.map((t) => (t.task_id === id ? { ...t, hours: h } : t)));
  const remove = (id) => setTasks(tasks.filter((t) => t.task_id !== id));
  const original = profiles.find((p) => p.id === person.id);
  const edited = original && JSON.stringify(original.tasks) !== JSON.stringify(person.tasks);
  const addable = catalogue.filter((c) => !tasks.some((t) => t.task_id === c.task_id));
  const byJob = addable.reduce((m, c) => ((m[c.job_name] ??= []).push(c), m), {});
  const picked = catalogue.find((c) => c.task_id === adding);

  function add() {
    if (!picked) return;
    setTasks([...tasks, { task_id: picked.task_id, name: picked.name, hours: 2 }]);
    setAdding("");
  }

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
          <button key={p.id ?? p.name} className={"person" + (p.id === person.id ? " on" : "")} onClick={() => pick(p)}>
            <b>{p.name}</b>
            <span>{p.title}</span>
          </button>
        ))}
      </div>

      <section className="card week">
        {hasHours ? (
          // list on the left, pastel pie on the right
          <WeekSplit
            person={person}
            onHours={setHours}
            onRemove={remove}
            footer={
              <div className="edit-bar">
                <p className="muted">You're in control: change hours, remove a task or add one. Everything else updates.</p>
                {Object.keys(byJob).length > 0 && (
                  <div className="add-row">
                    <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add a task">
                      <option value="">Add a task…</option>
                      {Object.entries(byJob).map(([job, list]) => (
                        <optgroup key={job} label={job}>
                          {list.map((c) => <option key={c.task_id} value={c.task_id}>{c.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <button className="btn-blue" disabled={!picked} onClick={add}>Add</button>
                  </div>
                )}
                {picked?.no_data && <p className="muted">No AI date for this task, counted as human work.</p>}
                {edited && <button className="link-btn" onClick={() => setPerson(original)}>Reset to the original week</button>}
              </div>
            }
          />
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