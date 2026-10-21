import { useState } from "react";

export default function Receipt({ source, children }) {
  const [open, setOpen] = useState(false);
  if (!source && !children) return null;
  return (
    <span className="receipt">
      <button className="receipt-btn" onClick={() => setOpen(!open)} aria-label="Show details">i</button>
      {open && (
        <span className="receipt-pop">
          {source && <b>{source.label}</b>}
          {source?.date && <span>As of {source.date}</span>}
          {children}
          {source?.isEstimate && <span className="badge-est">Estimate</span>}
          {source?.url && <a href={source.url} target="_blank" rel="noreferrer">Open source</a>}
        </span>
      )}
    </span>
  );
}