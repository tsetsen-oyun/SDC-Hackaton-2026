// A page title whose words fade in one after the other (same effect as the Forecast and You headlines).
// The text is the key, so the animation plays again when the title changes (another person or job).
export default function WordTitle({ text }) {
  const words = String(text).split(" ");
  return (
    <h1 key={text} className="hero hero-words" aria-label={text}>
      {words.map((w, i) => (
        <span key={w + i}>
          <span className="w-word" style={{ "--i": i }} aria-hidden="true">{w}</span>{" "}
        </span>
      ))}
    </h1>
  );
}