import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [person, setPerson] = useState(null);
  const [scenario, setScenario] = useState("moderate");
  const [year, setYear] = useState(2029);
  const [chosenJob, setChosenJob] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  const bumpData = () => setDataVersion((v) => v + 1);

  useEffect(() => {
    api.profiles()
      .then((res) => {
        const list = Array.isArray(res) ? res : Object.values(res);
        setProfiles(list);
        setPerson((p) => p ?? list[0]);
      })
      .catch(console.error);
  }, []);

  const value = {
    profiles, person, setPerson, scenario, setScenario, year, setYear,
    chosenJob, setChosenJob, snapshot, setSnapshot, dataVersion, bumpData,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}