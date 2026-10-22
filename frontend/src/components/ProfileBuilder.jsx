import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const KEY = "custom-profile";
const asList = (r) => (Array.isArray(r) ? r : r?.skills ?? Object.values(r ?? {}));

export function loadCustom() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; }
}
function saveCustom(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked: it just won't be remembered */ }
}

// A short form: who you are, what you do in a week, what you can do. Makes a new person for the whole app.
export default function ProfileBuilder({ catalogue, onUse, current }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(current?.name ?? "");
  const [title, setTitle] = useState(current?.title ?? "");
  const [tasks, setTasks] = useState(current?.tasks ?? []);
  const [skills, setSkills] = useState(current?.skills ?? []); // [{skill_id, name}]
  const [allSkills, setAllSkills] = useState(null); // null = loading, [] = not available
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState("");

  useEffect(() => {
    if (!open || allSkills) return;
    api.skills()
      .then((r) => setAllSkills(asList(r).map((s) => ({ skill_id: s.skill_id ?? s.id, name: s.name ?? s.skill_name }))))
      .catch(() => setAllSkills([]));
  }, [open, allSkills]);

  const byJob = useMemo(() => {
    const free = catalogue.filter((c) => !tasks.some((t) => t.task_id === c.task_id));
    return free.reduce((m, c) => ((m[c.job_name] ??= []).push(c), m), {});
  }, [catalogue, tasks]);

  const matches = useMemo(() => {
    const need = q.trim().toLowerCase();
    if (!allSkills || need.length < 2) return [];
    return allSkills
      .filter((s) => s.name?.toLowerCase().includes(need) && !skills.some((k) => k.skill_id === s.skill_id))
      .slice(0, 8);
  }, [allSkills, q, skills]);

  const total = tasks.reduce((s, t) => s + t.hours, 0);
  const ready = name.trim() && tasks.some((t) => t.hours > 0);

  function addTask() {
    const c = catalogue.find((x) => x.task_id === adding);
    if (!c) return;
    setTasks([...tasks, { task_id: c.task_id, name: c.name, hours: 4 }]);
    setAdding("");
  }

  function submit() {
    const person = {
      id: "custom",
      name: name.trim(),
      title: title.trim() || "Your profile",
      target_job: null,
      tasks: tasks.filter((t) => t.hours > 0),
      skill_ids: skills.map((s) => s.skill_id),
      skills,
    };
    saveCustom(person);
    onUse(person);
    setOpen(false);
  }

  if (!open)
    return (
      <button className="builder-open" onClick={() => setOpen(true)}>
        <b>+ Build your own profile</b>
        <span>Add your tasks and skills and see your own forecast</span>
      </button>
    );

  return (
    <section className="card builder">
      <div className="builder-head">
        <h2>Build your own profile</h2>
        <button className="link-btn" onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="muted">Use made-up details, not real personal data. Nothing leaves this demo.</p>

      <div className="b-row">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mei" /></label>
        <label>Job title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Admin executive" /></label>
      </div>

      <h3>1. What fills your week?</h3>
      {tasks.map((t) => (
        <div key={t.task_id} className="simple-row">
          <span>{t.name}</span>
          <span className="edit-hours">
            <input
              type="number" min="0" max="80" value={t.hours} aria-label={`Hours for ${t.name}`}
              onChange={(e) => setTasks(tasks.map((x) => (x.task_id === t.task_id ? { ...x, hours: Math.max(0, Number(e.target.value) || 0) } : x)))}
            />
            h
            <button className="x-btn" aria-label={`Remove ${t.name}`} onClick={() => setTasks(tasks.filter((x) => x.task_id !== t.task_id))}>×</button>
          </span>
        </div>
      ))}
      <div className="add-row">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Add a task">
          <option value="">{catalogue.length ? "Add a task…" : "Task list not available"}</option>
          {Object.entries(byJob).map(([job, list]) => (
            <optgroup key={job} label={job}>
              {list.map((c) => <option key={c.task_id} value={c.task_id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="btn-blue" disabled={!adding} onClick={addTask}>Add</button>
      </div>
      {total > 0 && <p className="muted">{total} hours a week in total.</p>}

      <h3>2. What can you already do?</h3>
      <div className="m-chips">
        {skills.map((s) => (
          <span key={s.skill_id} className="m-chip picked">
            {s.name}
            <button className="x-btn" aria-label={`Remove ${s.name}`} onClick={() => setSkills(skills.filter((k) => k.skill_id !== s.skill_id))}>×</button>
          </span>
        ))}
        {skills.length === 0 && <span className="muted">No skills picked yet.</span>}
      </div>
      {allSkills?.length === 0 ? (
        <p className="muted">The skill list isn't available yet, so you can only pick tasks for now.</p>
      ) : (
        <>
          <input className="skill-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={allSkills ? "Type to search skills, e.g. tax" : "Loading skills…"} disabled={!allSkills} />
          <div className="m-chips">
            {matches.map((s) => (
              <button key={s.skill_id} className="m-chip pick" onClick={() => { setSkills([...skills, s]); setQ(""); }}>+ {s.name}</button>
            ))}
          </div>
        </>
      )}

      <button className="btn-blue use-btn" disabled={!ready} onClick={submit}>Use this profile →</button>
      {!ready && <p className="muted">Add a name and at least one task with hours.</p>}
    </section>
  );
}
