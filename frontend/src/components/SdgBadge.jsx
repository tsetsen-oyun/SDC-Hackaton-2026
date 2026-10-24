// The official colour of each Sustainable Development Goal (published by the UN).
const GOAL_COLOUR = {
  1: "#e5243b", 2: "#dda63a", 3: "#4c9f38", 4: "#c5192d", 5: "#ff3a21", 6: "#26bde2",
  7: "#fcc30b", 8: "#a21942", 9: "#fd6925", 10: "#dd1367", 11: "#fd9d24", 12: "#bf8b2e",
  13: "#3f7e44", 14: "#0a97d9", 15: "#56c02b", 16: "#00689d", 17: "#19486a",
};
// goals whose colour is too light for white text
const DARK_TEXT = new Set([2, 6, 7, 11, 12, 15]);

// Some reasons arrive cut off mid-word at 200 characters (the Aurora ones). Cut them back to the last whole word.
const tidy = (t) => {
  if (!t || t.length < 195 || /[.!?)"”]$/.test(t)) return t;
  return t.slice(0, t.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
};

// A goal as a coloured circle with its number, followed by a rounded box with the words.
// target looks like "16.5": the goal number is the part before the dot.
// `children` (the small tags like "Estimate") go inside the box, under the words.
export default function SdgBadge({ target, label, reason, effect, children }) {
  const goal = parseInt(String(target), 10);
  const known = !Number.isNaN(goal);
  return (
    <span className="sdg-badge">
      <span
        className="sdg-tile" role="img" aria-label={`SDG ${known ? goal : target}${effect < 0 ? ", trade-off" : ""}`}
        style={{ background: GOAL_COLOUR[goal] ?? "#6b7280", color: DARK_TEXT.has(goal) ? "#1d2129" : "#fff" }}
      >
        {known ? goal : "?"}
      </span>
      <span className="sdg-text">
        <b>{label}</b>
        {reason && <span> · {tidy(reason)}</span>}
        {children && <span className="sdg-tags">{children}</span>}
      </span>
    </span>
  );
}