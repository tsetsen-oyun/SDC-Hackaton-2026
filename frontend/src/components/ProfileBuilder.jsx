import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { findSkills } from "../cv.js";
import { SAMPLE_CVS } from "../sampleCvs.js";

const KEY = "custom-profiles";
const asList = (r) => (Array.isArray(r) ? r : r?.skills ?? Object.values(r ?? {}));

export function loadCustoms() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveCustoms(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked: it just won't be remembered */ }
}

// A short form: who you are, what you do in a week, what you can do. Makes a new person for the whole app.
export default function ProfileBuilder({ catalogue, onUse }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [tasks, setTasks] = useState([]);
  const [skills, setSkills] = useState([]); // [{skill_id, name}]
  const [allSkills, setAllSkills] = useState(null); // null = loading, [] = not available
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState("");
  const [cvText, setCvText] = useState("");
  const [cvFound, setCvFound] = useState(null); // null = not run yet, else {added, maybe}
  const [cvNote, setCvNote] = useState("");

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

  // read a .txt file in this browser (it is never uploaded)
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCvFound(null);
    if (/\.(pdf|docx?|rtf|odt)$/i.test(file.name)) {
      setCvNote("PDF and Word files aren't supported yet. Open it, copy the text and paste it into the box.");
      return;
    }
    try {
      setCvText((await file.text()).slice(0, 20000));
      setCvNote(`Loaded ${file.name}.`);
    } catch {
      setCvNote("Couldn't read that file. Try pasting the text instead.");
    }
  }

  function readCv() {
    const { sure, maybe } = findSkills(cvText, allSkills);
    const have = new Set(skills.map((s) => s.skill_id));
    const added = sure.filter((s) => !have.has(s.skill_id));
    setSkills([...skills, ...added]);
    setCvFound({ total: sure.length, added: added.length, maybe: maybe.filter((m) => !have.has(m.skill_id)) });
  }

  function submit() {
    const person = {
      id: "custom-" + Date.now(),
      name: name.trim(),
      title: title.trim() || "Your profile",
      target_job: null,
      tasks: tasks.filter((t) => t.hours > 0),
      skill_ids: skills.map((s) => s.skill_id),
      skills: skills.map(({ skill_id, name }) => ({ skill_id, name })),
    };
    onUse(person);
    setName(""); setTitle(""); setTasks([]); setSkills([]); setQ(""); setCvText(""); setCvFound(null); setCvNote("");
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

      <div className="cv-box">
        <label htmlFor="cv-text"><b>Have a CV?</b> Paste it here and we'll pick out the skills.</label>
        <textarea
          id="cv-text" rows={6} value={cvText} onChange={(e) => { setCvText(e.target.value); setCvFound(null); }}
          placeholder="Paste the text of a made-up CV here, or try a sample below."
        />
        <div className="cv-actions">
          <button className="btn-blue" disabled={cvText.trim().length < 20 || !allSkills?.length} onClick={readCv}>Find my skills</button>
          <label className="link-btn cv-file">
            Open a .txt file
            <input type="file" accept=".txt,.md,text/plain" onChange={onFile} className="sr-only" />
          </label>
          <span className="muted">or try a sample:</span>
          {SAMPLE_CVS.map((c) => (
            <button key={c.id} className="m-chip pick" onClick={() => { setCvText(c.text); setCvFound(null); setCvNote(""); }}>{c.label}</button>
          ))}
        </div>
        <p className="muted cv-privacy">Your CV is read in this browser only. It is not uploaded or saved. Please use a made-up CV, not a real one.</p>
        {cvNote && <p className="muted" role="status">{cvNote}</p>}
        {cvFound && (
          <div role="status" className="cv-result">
            {cvFound.total === 0 ? (
              <p>We couldn't find any skills in that text. Try the search below, or paste more of the CV.</p>
            ) : (
              <p>
                <b>Found {cvFound.total} skill{cvFound.total === 1 ? "" : "s"}.</b>{" "}
                {cvFound.added > 0 ? `Added ${cvFound.added} to your list below.` : "They are already in your list."} Remove any that aren't right.
              </p>
            )}
            {cvFound.maybe.length > 0 && (
              <>
                <span className="m-label">Maybe, tick the ones that fit:</span>
                <div className="m-chips">
                  {cvFound.maybe.map((m) => (
                    <button
                      key={m.skill_id} className="m-chip pick" title={`Found: ${m.why}`}
                      onClick={() => { setSkills((cur) => [...cur, m]); setCvFound((f) => ({ ...f, maybe: f.maybe.filter((x) => x.skill_id !== m.skill_id) })); }}
                    >+ {m.name}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="m-chips">
        {skills.map((s) => (
          <span key={s.skill_id} className="m-chip picked" title={s.why ? `Found in your CV: ${s.why}` : undefined}>
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