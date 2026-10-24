import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { personTasks } from "../utils.js";
import WeekSplit from "../components/WeekSplit.jsx";
import Receipt from "../components/Receipt.jsx";
import { api } from "../api.js";
import Skeleton from "../components/Skeleton.jsx";
import PeopleDock from "../components/PeopleDock.jsx";
import { loadCustoms, saveCustoms } from "../components/ProfileBuilder.jsx";

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
  const [adding, setAdding] = useState("");
  const [catalogue, setCatalogue] = useState([]); // every task we know, for "add a task"
  const [undo, setUndo] = useState(null); // the task that was just removed, so it can be put back
  const undoTimer = useRef(null);
  useEffect(() => { setUndo(null); }, [person?.id]); // a different person: forget the undo
  useEffect(() => () => clearTimeout(undoTimer.current), []);
  useEffect(() => {
    api.tasks().then((r) => setCatalogue(Array.isArray(r) ? r : r.tasks ?? [])).catch(() => setCatalogue([]));
  }, []);
  if (!person) return <Skeleton rows={5} label="Loading people" />;

  const tasks = personTasks(person);
  const total = tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);

  // editing = making a new copy of the person with different tasks; the forecast etc. re-run by themselves
  const setTasks = (next) => setPerson({ ...person, tasks: next });
  const setHours = (id, h) => setTasks(tasks.map((t) => (t.task_id === id ? { ...t, hours: h } : t)));
  function remove(id) {
    const index = tasks.findIndex((t) => t.task_id === id);
    if (index < 0) return;
    setUndo({ task: tasks[index], index });
    setTasks(tasks.filter((t) => t.task_id !== id));
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 10000); // the Undo button stays for 10 seconds
  }
  function undoRemove() {
    if (!undo) return;
    const next = [...tasks];
    next.splice(Math.min(undo.index, next.length), 0, undo.task);
    setTasks(next);
    setUndo(null);
    clearTimeout(undoTimer.current);
  }
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
  // a person with a real week stays in "week" view even if they remove everything (so they can add tasks back)
  const hasHours = total > 0 || isCustom(person) || (original ? personTasks(original).some((t) => t.hours > 0) : false);
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

      <PeopleDock
        people={people}
        activeId={person.id ?? person.name}
        onPick={pick}
        onDelete={removePerson}
        hiddenCount={hidden.length}
        onRestore={restoreSamples}
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
                {undo && (
                  <div className="undo-bar" role="status">
                    <span>Removed “{undo.task.name}”.</span>
                    <button className="link-btn" onClick={undoRemove}>Undo</button>
                  </div>
                )}
                {total > 60 && (
                  <p className="warn" role="alert">
                    That adds up to {total} hours a week. Is that right? A normal full-time week is about 40.
                  </p>
                )}
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

      <Link to="/forecast" className="btn-orange">See my forecast →</Link>

    </>
  );
}