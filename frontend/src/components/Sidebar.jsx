import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";

// small inline icons so we don't need an icon library
const ICONS = {
  you: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  forecast: <><path d="M3 17l5-6 4 3 5-8 4 5" /><path d="M3 21h18" /></>,
  map: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 000-6H9a3 3 0 010-6h6.5" /></>,
  about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
};

const NAV = [
  ["You", "/", "you"],
  ["Forecast", "/forecast", "forecast"],
  ["Map", "/map", "map"],
  ["Route", "/route", "route"],
  ["About", "/about", "about"],
];

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : "…";

export default function Sidebar({ collapsed, onToggle }) {
  const { person, snapshot, setSnapshot, bumpData } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null);

  // runs once when the app first loads: ask the server which data snapshot it is using
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
      const date = r.snapshotDate ?? r.snapshot_date;
      setSnapshot(date);
      if (r.changed) bumpData(); // only reload the pages when there really is new data
      if (r.fallback) {
        setNotice({ ok: false, text: `Couldn't get new data, so we're still using the saved copy from ${formatDate(date)}.` });
      } else if (r.changed) {
        setNotice({ ok: true, text: `New data loaded${r.previous ? ` (was ${formatDate(r.previous)})` : ""}. Pages updated.` });
      } else {
        setNotice({ ok: true, text: "Already up to date. No new data since the last refresh." });
      }
    } catch (e) {
      console.error(e);
      setNotice({ ok: false, text: `Couldn't load new data, so we're still using the saved copy from ${formatDate(snapshot)}.` });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <aside className={"sidebar" + (collapsed ? " collapsed" : "")}>
      <div className="side-head">
        <button
          className="side-toggle" onClick={onToggle}
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Open sidebar" : "Close sidebar"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="4" />
            <path d="M9.5 4v16" />
          </svg>
        </button>
        <div className="brand">
          <span className="label">[App name]</span>
        </div>
      </div>

      <nav className="side-nav">
        {NAV.map(([label, to, icon]) => (
          <NavLink
            key={to} to={to} end title={label}
            className={({ isActive }) => "nav-item" + (isActive ? " on" : "")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[icon]}
            </svg>
            <span className="label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="side-spacer" />

      <div className="profile-card">
        <div className="profile-top">
          <span className="avatar">{person?.name?.[0] ?? "?"}</span>
          <span className="label">
            <b>{person?.name ?? "Loading…"}</b>
            <small>{person?.title}</small>
          </span>
        </div>
        <div className="label profile-data">
          <div className="mono">Data from {formatDate(snapshot)}</div>
          <button className="refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Refreshing…" : "Refresh data"}
          </button>
          {notice && <p className={"notice" + (notice.ok ? " ok" : "")} role="status">{notice.text}</p>}
        </div>
      </div>
    </aside>
  );
}