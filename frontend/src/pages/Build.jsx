import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext.jsx";
import { api } from "../api.js";
import ProfileBuilder, { loadCustoms, saveCustoms } from "../components/ProfileBuilder.jsx";

// Build your own profile: tasks, skills (or a pasted CV), then on to the You page.
export default function Build() {
  const { setPerson, setChosenJob } = useApp();
  const navigate = useNavigate();
  const [catalogue, setCatalogue] = useState([]); // every task we know, for "add a task"

  useEffect(() => {
    api.tasks().then((r) => setCatalogue(Array.isArray(r) ? r : r.tasks ?? [])).catch(() => setCatalogue([]));
  }, []);

  function use(person) {
    saveCustoms([...loadCustoms(), person]);
    setPerson(person);
    setChosenJob(null);
    navigate("/");
  }

  return (
    <>
      <h1 className="hero">Build your own profile</h1>
      <p className="lead muted">Use made-up details, not real personal data. Nothing is saved. If the AI helper is on, the text in the "describe your week" box is sent to the AI service named on the About page to match it to our task list.</p>
      <ProfileBuilder catalogue={catalogue} onUse={use} />
    </>
  );
}