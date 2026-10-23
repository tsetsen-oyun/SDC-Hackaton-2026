import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { personTasks } from "../utils.js";
import WeekSplit from "../components/WeekSplit.jsx";
import Receipt from "../components/Receipt.jsx";
import { api } from "../api.js";
import ProfileBuilder, { loadCustoms, saveCustoms } from "../components/ProfileBuilder.jsx";

const STAT_SOURCE = { label: "ISIS Malaysia & World Bank", date: "2025", isEstimate: false };

// words of the headline; `c` = a colour for the highlighted words, `count` = the number that counts up
const HERO = [
  { t: "Did", m: 1 }, { t: "you", m: 1 }, { t: "know?", m: 1 },
  { t: "About" }, { t: "45%", count: 45, c: "#ff7a66" }, { t: "of" }, { t: "Malaysian" }, { t: "workers" },
  { t: "have" }, { t: "at" }, { t: "least" }, { t: "40%" }, { t: "of" }, { t: "their" }, { t: "tasks" }, { t: "that" },
  { t: "today's", c: "#ff8a6b" }, { t: "AI", c: "#fb7a62" }, { t: "could", c: "#f2644f" }, { t: "do.", c: "#e8453c" },
];

function useCountUp(to, delay = 450, ms = 1200) {
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [n, setN] = useState(still ? to : 0);
  useEffect(() => {
    if (still) return;
    let raf, start;
    const id = setTimeout(() => {
      const step = (now) => {
        start ??= now;
        const p = Math.min(1, (now - start) / ms);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); // eases out
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(id); cancelAnimationFrame(raf); };
  }, [to, delay, ms, still]);
  return n;
}

function StatHero() {
  const n = useCountUp(45);
  return (
    <header className="stat-hero">
      <h1 aria-label="Did you know? About 45% of Malaysian workers have at least 40% of their tasks that today's AI could do.">
        {HERO.map((w, i) => (
          <span key={i}>
            <span className={"w" + (w.m ? " muted" : "")} style={{ "--i": i, color: w.c }} aria-hidden="true">
              {w.count ? `${n}%` : w.t}
            </span>{" "}
          </span>
        ))}
        <Receipt source={STAT_SOURCE} />
      </h1>
      <p className="stat-sub">
        Let's make sure AI works <b>for you</b>, not instead of you.
      </p>
    </header>
  );
}

export default function You() {
  const { profiles, person, setPerson, setChosenJob } = useApp();
  const [customs, setCustoms] = useState(() => loadCustoms());
  const [hidden, setHidden] = useState(() => {
    try { return JSON.parse(localStorage.getItem("hidden-people")) ?? []; } catch { return []; }
  });
  const [confirmId, setConfirmId] = useState(null);
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

  const isCustom = (p) => String(p.id).startsWith("custom-");
  const people = [...profiles.filter((p) => !hidden.includes(p.id)), ...customs];

  function removePerson(p) {
    const left = people.filter((x) => x.id !== p.id);
    if (left.length === 0) return; // never leave the app with nobody to show
    if (isCustom(p)) {
      const next = customs.filter((c) => c.id !== p.id);
      setCustoms(next); saveCustoms(next);
    } else {
      const next = [...hidden, p.id];
      setHidden(next);
      try { localStorage.setItem("hidden-people", JSON.stringify(next)); } catch { /* ignore */ }
    }
    setConfirmId(null);
    if (p.id === person.id) pick(left[0]); // the person on screen was deleted: switch to the next one
  }

  function restoreSamples() {
    setHidden([]);
    try { localStorage.removeItem("hidden-people"); } catch { /* ignore */ }
  }

  function pick(p) {
    setPerson(p);
    setChosenJob(null);
  }

  return (
    <>
      <StatHero />

      <h2>Choose a sample person</h2>
      <div className="people">
        {people.map((p) => (
          <div key={p.id ?? p.name} className="person-wrap">
            <button className={"person" + (p.id === person.id ? " on" : "")} onClick={() => pick(p)}>
              <b>{p.name}</b>
              <span>{p.title}</span>
            </button>
            {confirmId === p.id ? (
              <div className="person-confirm" role="alert">
                <span>Delete {p.name}?</span>
                <button className="danger" onClick={() => removePerson(p)}>Delete</button>
                <button onClick={() => setConfirmId(null)}>Cancel</button>
              </div>
            ) : (
              <button
                className="person-x"
                aria-label={`Delete ${p.name}`}
                title={people.length <= 1 ? "Keep at least one person" : `Delete ${p.name}`}
                disabled={people.length <= 1}
                onClick={() => setConfirmId(p.id)}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {hidden.length > 0 && (
        <button className="link-btn restore" onClick={restoreSamples}>Restore sample people</button>
      )}

      <ProfileBuilder
        catalogue={catalogue}
        onUse={(p) => { const next = [...customs, p]; setCustoms(next); saveCustoms(next); pick(p); }}
      />

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