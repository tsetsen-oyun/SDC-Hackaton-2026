import { useEffect, useState } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import GradientBackground from "./components/GradientBackground.jsx";
import ScenarioDock from "./components/ScenarioDock.jsx";
import Build from "./pages/Build.jsx";
import You from "./pages/You.jsx";
import Forecast from "./pages/Forecast.jsx";
import MapPage from "./pages/MapPage.jsx";
import RoutePage from "./pages/RoutePage.jsx";
import About from "./pages/About.jsx";

const KEY = "sidebar-collapsed";

export default function App() {
  // remember the choice, but never crash if the browser blocks storage
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // opening the app (or reloading) always starts on You, even if the tab was left on Build
  useEffect(() => { if (pathname === "/build") navigate("/", { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });

  function toggle() {
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  }

  return (
    <div className="app-bg">
      <GradientBackground />
      <div className={"shell" + (collapsed ? " wide" : "")}>
        <div className="panel">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
          <main className="content">
            <Routes>
              <Route path="/build" element={<Build />} />
              <Route path="/" element={<You />} />
              <Route path="/forecast" element={<Forecast />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/route" element={<RoutePage />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </main>
        </div>
      </div>
      {/* the scenario only changes Forecast, Map and Route, so the You page doesn't show it */}
      {pathname !== "/" && pathname !== "/build" && <ScenarioDock />}
    </div>
  );
}