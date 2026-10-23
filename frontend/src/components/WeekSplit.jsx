import { useState } from "react";
import { personTasks } from "../utils.js";

// shades of blue, dark to light, one per task (they repeat if there are more tasks than shades)
const COLORS = ["#2f45d4", "#4663f0", "#5b8cff", "#6aa8ff", "#82bcff", "#9fd0ff", "#3d7bff", "#b9defc"];
// white labels on the dark shades, dark labels on the light ones
const DARK = new Set(["#2f45d4", "#4663f0", "#5b8cff", "#3d7bff"]);

// angle (radians, 0 = 12 o'clock) -> point on the circle
const point = (cx, cy, r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

function slicePath(cx, cy, r, a0, a1) {
  // a full circle can't be drawn as one arc, so a single task becomes a circle
  if (a1 - a0 >= Math.PI * 2 - 0.001) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const [x0, y0] = point(cx, cy, r, a0);
  const [x1, y1] = point(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
}

export default function WeekSplit({ person, onHours, onRemove, footer }) {
  const editable = Boolean(onHours);
  const [hover, setHover] = useState(null);
  const tasks = personTasks(person).map((t, i) => ({
    id: t.task_id ?? t.id ?? i,
    name: t.name ?? t.task ?? "Task",
    hours: Number(t.hours) || 0,
    color: COLORS[i % COLORS.length],
  }));
  const total = tasks.reduce((s, t) => s + t.hours, 0);
  if (total === 0) return <section className="week-split"><h2>{person.name}'s week</h2>{footer}</section>;

  let angle = 0;
  const slices = tasks.map((t) => {
    const a0 = angle;
    angle += (t.hours / total) * Math.PI * 2;
    return { ...t, a0, a1: angle };
  });

  return (
    <section className="week-split">
      <h2>{person.name}'s week ({total} hours)</h2>
      <div className="split-grid">
        <div className="split-list">
          {slices.map((s) => (
            <div
              key={s.id}
              className={"simple-row" + (hover === s.id ? " on" : "")}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="split-name">
                <i className="dot" style={{ "--c": s.color }} />
                {s.name}
              </span>
              {editable ? (
                <span className="edit-hours">
                  <input
                    type="number" min="0" max="80" step="1" value={s.hours}
                    aria-label={`Hours for ${s.name}`}
                    onChange={(e) => onHours(s.id, Math.max(0, Number(e.target.value) || 0))}
                  />
                  h
                  <button className="x-btn" aria-label={`Remove ${s.name}`} onClick={() => onRemove(s.id)}>×</button>
                </span>
              ) : (
                <span>{s.hours} h</span>
              )}
            </div>
          ))}
          {footer}
        </div>

        <div className="pie-glass">
          <svg className="pie" viewBox="0 0 220 220" role="img" aria-label={`${person.name}'s ${total} hours split by task`}>
            <defs>
              {slices.map((s, i) => (
                <linearGradient key={s.id} id={`ws-g-${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity="0.95" />
                  <stop offset="1" stopColor={s.color} stopOpacity="0.55" />
                </linearGradient>
              ))}
              {/* soft white shine from the top left, like light on glass */}
              <radialGradient id="ws-shine" cx="0.3" cy="0.2" r="0.85">
                <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="0.12" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>
            {slices.map((s, i) => {
              return (
                <g key={s.id} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                  <path
                    d={slicePath(110, 110, hover === s.id ? 106 : 102, s.a0, s.a1)}
                    fill={`url(#ws-g-${i})`}
                    stroke="#fff"
                    strokeOpacity="0.85"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
            <circle cx="110" cy="110" r="102" fill="url(#ws-shine)" pointerEvents="none" />
            <circle cx="110" cy="110" r="102" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" pointerEvents="none" />
            {/* labels go last so the shine never fades them */}
            {slices.map((s) => {
              if (s.a1 - s.a0 <= 0.45) return null;
              const [lx, ly] = point(110, 110, 68, (s.a0 + s.a1) / 2);
              return (
                <text key={s.id} x={lx} y={ly} textAnchor="middle" dominantBaseline="central" className="pie-label" style={{ fill: DARK.has(s.color) ? "#fff" : "#1f2a5c" }}>
                  {s.hours} h
                </text>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}