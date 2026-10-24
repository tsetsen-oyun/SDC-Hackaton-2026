import { useEffect, useRef, useState } from "react";

// A section heading (h2 / h3) whose words fade in one after the other, once it scrolls into view.
export default function WordHeading({ as: Tag = "h2", text, className = "" }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return (
    <Tag ref={ref} className={`hero-words word-heading${seen ? " in" : ""} ${className}`.trim()} aria-label={text}>
      {String(text).split(" ").map((w, i) => (
        <span key={w + i}>
          <span className="w-word" style={{ "--i": i }} aria-hidden="true">{w}</span>{" "}
        </span>
      ))}
    </Tag>
  );
}