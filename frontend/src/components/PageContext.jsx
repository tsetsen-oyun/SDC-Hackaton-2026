import { useApp } from "../context/AppContext.jsx";

const SCENARIO = { slowdown: "Slowdown", moderate: "Normal pace", fast: "Fast pace" };

// A small strip at the top of Forecast, Map and Route that answers three questions:
// where am I in the journey, which scenario and year am I looking at, and how sure are these numbers?
export default function PageContext({ step, showYear = true }) {
  const { scenario, year } = useApp();
  return (
    <div className="page-ctx">
      <span className="ctx-chip step">Step {step} of 4</span>
      <span className="ctx-chip" title="Change the scenario with the tiles at the bottom of the screen">
        {SCENARIO[scenario] ?? scenario}{showYear && ` · ${year}`}
      </span>
      <span className="est-note">These are estimates, not predictions. Tap (i) to see where each number comes from.</span>
    </div>
  );
}