import { Routes, Route } from "react-router-dom";
import TopBar from "./components/TopBar.jsx";
import You from "./pages/You.jsx";
import Forecast from "./pages/Forecast.jsx";
import MapPage from "./pages/MapPage.jsx";
import RoutePage from "./pages/RoutePage.jsx";
import About from "./pages/About.jsx";

export default function App() {
  return (
    <>
      <TopBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<You />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </>
  );
}