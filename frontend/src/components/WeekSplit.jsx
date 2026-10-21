import { useState } from "react";
import { personTasks } from "../utils.js";

const CORAL = "#ff6f61";
const RED = "#d93a2f";
// most hours = darkest, fewest = lightest (opacity 0.22 to 1)
const shade = (h, min, max) => (max === min ? 0.6 : 0.22 + ((h - min) / (max - min)) * 0.78);

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
  }));
  const hrs = tasks.map((t) => t.hours);
  const min = Math.min(...hrs), max = Math.max(...hrs);
  tasks.forEach((t) => { t.opacity = shade(t.hours, min, max); });
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
                <i className="dot" style={{ background: CORAL, opacity: s.opacity }} />
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

        <svg className="pie" viewBox="0 0 220 220" role="img" aria-label={`${person.name}'s ${total} hours split by task`}>
          {slices.map((s) => {
            const mid = (s.a0 + s.a1) / 2;
            const [lx, ly] = point(110, 110, 68, mid);
            const big = s.a1 - s.a0 > 0.45;
            return (
              <g key={s.id} onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                <path
                  d={slicePath(110, 110, hover === s.id ? 106 : 102, s.a0, s.a1)}
                  fill={CORAL}
                  fillOpacity={s.opacity}
                  stroke={RED}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
                {big && (
                  <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" className="pie-label">
                    {s.hours} h
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}