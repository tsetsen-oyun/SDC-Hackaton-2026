// Five soft blue blobs that slowly wander behind the app, under a fine film grain.
// Decoration only: hidden from screen readers, ignores clicks, and stands still if the user prefers reduced motion.
// Change the colours below (any CSS colours), or set `speed` (2 = twice as fast) and `grain={false}`.
const COLORS = ["#3b5bff", "#904a8b", "#a929cd", "#36c3ff", "#2f45d4"];

export default function GradientBackground({ colors = COLORS, speed = 10, grain = true }) {
  const style = { "--g-speed": speed };
  colors.slice(0, 5).forEach((c, i) => { style[`--g-c${i + 1}`] = c; });
  return (
    <div className="g-bg" aria-hidden="true" style={style}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`g-blob g-blob-${n}`} />)}
      {grain && <span className="g-grain" />}
    </div>
  );
}