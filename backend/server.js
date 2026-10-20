import "dotenv/config";
import express from "express";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend is working!" });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/api/profiles", (req, res) => {

});

app.post("/api/forecast", (req, res) => {
  // Destructure the parameters from the request body
  const { tasks, scenarios } = req.body;

  // Example logic using the parameters
  if (!tasks || !scenarios) {
    return res.status(400).json({ error: "Missing tasks or scenarios" });
  }

  res.json({ message: "Forecast generated successfully", tasks, scenarios });
});

app.post("/api/match", (req, res) => {
  const { tasks, skills, scenario, mode } = req.body;

  if (!tasks || !skills || !scenario || !mode) {
    return res.status(400).json({ error: "Missing attribute" });
  }

  res.json({ message: "Match request sent successfully", tasks, scenarios });
});

app.post("/api/route", (req, res) => {
  const { jobId, skills, scenario } = req.body;
});

app.get("/api/sources", (req, res) => {

});

app.post("/api/refresh", (req, res) => {

});