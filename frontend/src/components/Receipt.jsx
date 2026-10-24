import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The (i) button and its popup. The popup is drawn on the page itself (not inside the card),
// so it always sits on top of everything instead of being hidden behind the card below.
export default function Receipt({ source, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left } in screen pixels
  const btn = useRef(null);
  const pop = useRef(null);

  // place the popup under the button, or above it when there is no room, and keep it on screen
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return;
    const b = btn.current.getBoundingClientRect();
    const p = pop.current.getBoundingClientRect();
    const gap = 8, edge = 12;
    let top = b.bottom + gap;
    if (top + p.height > window.innerHeight - edge && b.top - gap - p.height > edge) top = b.top - gap - p.height;
    top = Math.max(edge, Math.min(top, window.innerHeight - p.height - edge));
    const left = Math.max(edge, Math.min(b.left + b.width / 2 - p.width / 2, window.innerWidth - p.width - edge));
    setPos({ top, left });
  }, [open, source, children]);

  // close on Escape, a click elsewhere, scrolling or resizing (the popup would drift away from its button)
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const outside = (e) => {
      if (pop.current?.contains(e.target) || btn.current?.contains(e.target)) return;
      close();
    };
    const key = (e) => { if (e.key === "Escape") { close(); btn.current?.focus(); } };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!source && !children) return null;
  return (
    <span className="receipt">
      <button
        ref={btn} className="receipt-btn" aria-label="Show details" aria-expanded={open}
        onClick={() => { setPos(null); setOpen(!open); }}
      >i</button>
      {open && createPortal(
        <span
          ref={pop} className="receipt-pop receipt-fixed" role="dialog"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
        >
          {source && <b>{source.label}</b>}
          {source?.date && <span>As of {source.date}</span>}
          {children}
          {source?.isEstimate && <span className="badge-est">Estimate</span>}
          {source?.url && <a href={source.url} target="_blank" rel="noreferrer">Open source</a>}
        </span>,
        document.body
      )}
    </span>
  );
}