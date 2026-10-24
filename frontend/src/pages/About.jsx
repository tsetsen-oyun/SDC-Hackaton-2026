import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import Skeleton from "../components/Skeleton.jsx";

export default function About() {
  const { dataVersion } = useApp();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.sources().then(setInfo).catch((e) => setError(e.message));
  }, [dataVersion]);

  if (error) return <p>Couldn't load the data info: {error}</p>;
  if (!info) return <Skeleton rows={5} label="Loading the data info" />;

  return (
    <>
      <h1 className="hero">About the data</h1>
      <p className="lead muted">Where every number comes from, and what it can't tell you.</p>

      <div className="stack">
        <section className="card about-card">
          <h2>Snapshot and model</h2>
          <p>Data snapshot: <b>{info.snapshotDate ?? info.snapshot_date}</b></p>
          {info.liveCheck && (
            <p>
              Last checked live against metr.org: <b>{new Date(info.liveCheck.checked_at).toUTCString()}</b>
              {info.liveCheck.result === "matches_saved" ? " (METR's current file matches our saved data)" : " (new data found and loaded)"}
            </p>
          )}
          {info.fetchedLive && info.fetchedAt && (
            <p>AI-progress data fetched live from metr.org on <b>{new Date(info.fetchedAt).toUTCString()}</b></p>
          )}
          <p>AI model used: <b>{info.model ?? "None"}</b></p>
        </section>

        <section className="card about-card">
          <h2>Sources</h2>
          <ul className="plain-list">
            {(info.sources ?? []).map((s, i) => (
              <li key={i}>
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> : s.label}
                {s.date && <span className="muted"> · {s.date}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="card about-card">
          <h2>Assumptions and limits</h2>
          <ul className="plain-list">
            {(info.assumptions ?? []).map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </section>

        <section className="card about-card">
          <h2>How to read this</h2>
          <p>
            Every date and score is an estimate under the scenario you pick. The app suggests,
            and people decide. It only uses jobs and courses from our data files and never makes any up.
          </p>
        </section>
      </div>
    </>
  );
}