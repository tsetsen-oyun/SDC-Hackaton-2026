import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// The "who are we looking at" picker: same floating glass dock as the scenario tiles, shown on the You page.
// "No current job · aiming for X" reads better as "Aiming for X" on a small tile
const shortTitle = (t = "") => t.replace(/^No current job · aiming for /, "Aiming for ");

export default function PeopleDock({ people, activeId, onPick, onDelete, hiddenCount, onRestore }) {
  const [confirmId, setConfirmId] = useState(null);
  const idOf = (p) => p.id ?? p.name;
  const dockRef = useRef(null);

  // on a narrow screen the dock scrolls sideways: keep the chosen person in view
  useEffect(() => {
    dockRef.current?.querySelector(".person-tile.on")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId, people.length]);

  return (
    <div className="dock-wrap inline">
      <nav className="dock people-dock" aria-label="Choose a sample person" ref={dockRef}>
        <div className="dock-head">
          <h2 className="dock-title">Choose a sample person</h2>
          <div className="dock-head-actions">
            {hiddenCount > 0 && (
              <button className="dock-restore" onClick={onRestore}>Restore sample people</button>
            )}
            <Link to="/build" className="dock-create">
              <span aria-hidden="true">+</span> Build your own profile
            </Link>
          </div>
        </div>
        <div className="dock-tiles">
        {people.map((p) => {
          const id = idOf(p);
          const on = id === activeId;
          const asking = confirmId === id;
          return (
            <div key={id} className="tile-wrap">
              {asking ? (
                <div className="dock-tile tile-confirm" role="alert">
                  <span>Delete {p.name}?</span>
                  <span className="tile-confirm-btns">
                    <button className="danger" onClick={() => { onDelete(p); setConfirmId(null); }}>Delete</button>
                    <button onClick={() => setConfirmId(null)}>Cancel</button>
                  </span>
                </div>
              ) : (
                <>
                  <button
                    className={"dock-tile person-tile" + (on ? " on" : "")}
                    aria-pressed={on}
                    title={`${p.name}: ${p.title}`}
                    onClick={() => onPick(p)}
                  >
                    <span className="tile-avatar" aria-hidden="true">{p.name?.[0] ?? "?"}</span>
                    <span className="tile-name">{p.name}</span>
                    <span className="tile-sub">{shortTitle(p.title)}</span>
                  </button>
                  <button
                    className="tile-x"
                    aria-label={`Delete ${p.name}`}
                    title={people.length <= 1 ? "Keep at least one person" : `Delete ${p.name}`}
                    disabled={people.length <= 1}
                    onClick={() => setConfirmId(id)}
                  >×</button>
                </>
              )}
            </div>
          );
        })}
        </div>
      </nav>
    </div>
  );
}