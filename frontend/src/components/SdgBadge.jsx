import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Some reasons arrive cut off mid-word at 200 characters (the Aurora ones). Cut them back to the last whole word.
const tidy = (t) => {
  if (!t || t.length < 195 || /[.!?)"”]$/.test(t)) return t;
  return t.slice(0, t.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "…";
};

// "SDG 8. Decent work and economic growth" as an outlined pill. Hover (or focus / tap) shows the reason.
// The note is drawn on the page itself, so it is never hidden behind the card below.
// target looks like "8.2": the goal number is the part before the dot.
export default function SdgBadge({ target, label, reason, effect, offTrack, children }) {
  const goal = parseInt(String(target), 10);
  const id = useId();
  const pill = useRef(null);
  const tip = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const text = tidy(reason);
  const hasTip = Boolean(text || offTrack);

  useLayoutEffect(() => {
    if (!open || !pill.current || !tip.current) return;
    const b = pill.current.getBoundingClientRect();
    const p = tip.current.getBoundingClientRect();
    const gap = 8, edge = 12;
    let top = b.bottom + gap;
    if (top + p.height > window.innerHeight - edge && b.top - gap - p.height > edge) top = b.top - gap - p.height;
    const left = Math.max(edge, Math.min(b.left, window.innerWidth - p.width - edge));
    setPos({ top, left });
  }, [open, text, offTrack]);

  const show = () => { setPos(null); setOpen(true); };
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={pill} className="pill pill-outline sdg-pill" tabIndex={hasTip ? 0 : undefined}
        aria-describedby={open ? id : undefined}
        onMouseEnter={hasTip ? show : undefined} onMouseLeave={hide}
        onFocus={hasTip ? show : undefined} onBlur={hide}
        onKeyDown={(e) => { if (e.key === "Escape") hide(); }}
      >
        <span className="sdg-sign" aria-hidden="true">{effect < 0 ? "−" : "+"}</span>{" "}
        {Number.isNaN(goal) ? "SDG" : `SDG ${goal}.`} {label}
      </span>
      {open && hasTip && createPortal(
        <span
          id={id} ref={tip} role="tooltip" className="receipt-pop receipt-fixed"
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden", pointerEvents: "none" }}
        >
          {text && <span>{text}</span>}
          {offTrack && <span className="sdg-tag off tip-tag">Malaysia off track</span>}
        </span>,
        document.body
      )}
      {children}
    </>
  );
}