import { useApp } from "../context/AppContext.jsx";

// the little curve in each tile shows how fast AI improves in that scenario
const SCENARIOS = [
  { id: "slowdown", label: "Slowdown", path: "M3 31C18 22 30 14 42 11C50 9.5 57 9 61 9" },
  { id: "moderate", label: "Normal pace", path: "M3 32C20 28 38 20 61 6" },
  { id: "fast", label: "Fast pace", path: "M3 33C28 32 44 26 52 14C56 8 59 5 61 3" },
];

export default function ScenarioDock() {
  const { scenario, setScenario } = useApp();
  return (
    <nav className="dock" aria-label="Scenario">
      {SCENARIOS.map((s) => {
        const on = scenario === s.id;
        return (
          <button
            key={s.id}
            className={"dock-tile" + (on ? " on" : "")}
            aria-pressed={on}
            onClick={() => setScenario(s.id)}
          >
            <svg width="64" height="36" viewBox="0 0 64 36" fill="none" strokeLinecap="round" aria-hidden="true"
              stroke={on ? "#2f45d4" : "#8d96ac"} strokeWidth={on ? 2.8 : 2.5}>
              <path d={s.path} />
              {on && <circle cx="61" cy="6" r="3" fill="#ff6f61" stroke="#ff6f61" />}
            </svg>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
