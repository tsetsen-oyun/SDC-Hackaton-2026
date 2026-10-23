// A grey "shape of the page" shown while data loads, so the screen never looks empty or broken.
export default function Skeleton({ rows = 5, label = "Loading" }) {
  return (
    <div className="skel" role="status" aria-busy="true">
      <span className="sr-only">{label}…</span>
      <div className="skel-line skel-title" />
      <div className="skel-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skel-line" style={{ width: `${96 - ((i * 13) % 34)}%` }} />
        ))}
      </div>
    </div>
  );
}