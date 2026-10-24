import Receipt from "./Receipt.jsx";

// Some reasons arrive cut off mid-word at 200 characters (the Aurora ones). Cut them back to the last whole word.
const tidy = (t) => {
  if (!t || t.length < 195 || /[.!?)"”]$/.test(t)) return t;
  return t.slice(0, t.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
};

// One line: "SDG 8. Decent work and economic growth", an (i) with the reason, then the small tags.
// target looks like "8.2": the goal number is the part before the dot.
export default function SdgBadge({ target, label, reason, children }) {
  const goal = parseInt(String(target), 10);
  return (
    <>
      <span className="sdg-name">
        <b>{Number.isNaN(goal) ? "SDG" : `SDG ${goal}.`}</b> {label}
      </span>
      {reason && <Receipt><span>{tidy(reason)}</span></Receipt>}
      {children}
    </>
  );
}