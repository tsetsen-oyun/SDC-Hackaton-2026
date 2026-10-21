import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import "./TopBar.css";

const TABS = [
  ["You", "/"],
  ["Forecast", "/forecast"],
  ["Map", "/map"],
  ["Route", "/route"],
];

const SCENARIOS = [
  { id: "moderate", label: "Normal pace" },
  { id: "fast", label: "Fast pace" },
  { id: "slowdown", label: "Slowdown" },
];

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
      })
    : "…";

export default function TopBar() {
  const { scenario, setScenario, snapshot, setSnapshot, bumpData } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);

  // runs once when the app first loads
  useEffect(() => {
    api.sources()
      .then((s) => setSnapshot(s.snapshotDate ?? s.snapshot_date))
      .catch(console.error);
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setNotice(null);
    try {
      const r = await api.refresh();
      setSnapshot(r.snapshotDate ?? r.snapshot_date);
      bumpData();
    } catch (e) {
      console.error(e);
      setNotice(`Couldn't load new data, so we're still using the saved copy from ${formatDate(snapshot)}.`);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-row topbar-main">
        <div className="brand">
          <span className="brand-mark" />
          [App name]
        </div>
        <nav className="tabs">
          {TABS.map(([label, to]) => (
            <NavLink
              key={to} to={to} end
              className={({ isActive }) => "tab" + (isActive ? " active" : "")}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/about" className="about-link">About the data</NavLink>
      </div>

      <div className="topbar-row topbar-sub">
        <div className="scenario">
          <span className="muted">Scenario</span>
          <div className="segmented">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={scenario === s.id ? "on" : ""}
                aria-pressed={scenario === s.id}
                onClick={() => setScenario(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="snapshot">
          <span className="muted">Data: snapshot <b>{formatDate(snapshot)}</b></span>
          <button className="refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
      </div>
      
      {notice && <div className="notice" role="alert">{notice}</div>}
    </header>
  );
}