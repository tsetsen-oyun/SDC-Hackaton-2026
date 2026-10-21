import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { listSnapshots, loadSnapshot, splitSourceIds } from "../load.js";

const DIR = fileURLToPath(new URL("./fixtures/snapshots/", import.meta.url));
const old = loadSnapshot("2026-04-01", DIR);
const now = loadSnapshot("2026-10-20", DIR);

test("lists snapshot folders oldest first", () => {
  assert.deepEqual(listSnapshots(DIR), ["2026-04-01", "2026-10-20"]);
});

test("a description with commas stays one cell", () => {
  assert.equal(old.tasks.get("TASK_1").task_description, "Enter invoice data, including tax codes, into the system");
});

test("numbers become numbers and blank cells become null", () => {
  const t1 = old.tasks.get("TASK_1");
  assert.equal(t1.minutes_median, 2.4);
  assert.equal(t1.minutes_is_estimate, true);
  assert.equal(old.tasks.get("TASK_5").minutes_median, null);
});

test("ISCO codes stay text", () => {
  assert.equal(old.roles.get("JOB_AP").isco_code, "4311");
});

test("lists inside a cell are split on ;", () => {
  assert.deepEqual(old.roles.get("JOB_AUD").skill_ids, ["S_INVEST", "S_AUDIT", "S_REPORT", "S_COMM"]);
});

test("a person's tasks become task ids with hours", () => {
  const siti = old.users.get("siti");
  assert.deepEqual(siti.tasks[0], { task_id: "TASK_1", hours: 12 });
  assert.equal(siti.tasks.reduce((sum, t) => sum + t.hours, 0), 40);
});

test("a skill outside the task's job is dropped, with a warning", () => {
  assert.deepEqual(old.taskSkills.get("TASK_1"), ["S_DATA"]);
  assert.ok(old.warnings.some((w) => w.includes("TASK_1 -> S_MODEL")));
  assert.equal(now.warnings.length, 0);
});

test("missing optional files are listed, not fatal", () => {
  assert.deepEqual(old.missing, ["job_skills.csv", "sdg_links.csv", "courses.csv"]);
  assert.deepEqual(old.courses, []);
});

test("sources are looked up by id", () => {
  assert.equal(old.sources.get("test_aei").name, "TEST: made-up task times");
});

test("slowdown milestones are sorted from shortest to longest", () => {
  assert.deepEqual(old.milestones.map((m) => m.task_length_minutes), [2400, 10000, 30000, 120000]);
});

test("slowdown milestones: 50% rows are left out, a row with no length is skipped with a warning", () => {
  assert.ok(old.milestones.every((m) => m.reliability === "80%"));
  assert.ok(old.warnings.some((w) => w.includes('skipped "1 day"')));
});

test("a source cell with several ids is split into separate ids", () => {
  assert.deepEqual(splitSourceIds(["onet;aei_2026_03", "onet", null, " esco ;"]), ["onet", "aei_2026_03", "esco"]);
});

test("one combined occupation code is split into three", async () => {
  const { default: fs } = await import("node:fs");
  const { default: os } = await import("node:os");
  const { default: path } = await import("node:path");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "snap-"));
  const folder = path.join(tmp, "2026-01-01");
  fs.cpSync(path.join(DIR, "2026-10-20"), folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "roles.csv"),
    "role_id,role_name,occupation_code,skill_ids\nJOB_AP,Clerk,43-3031.00;http://esco/x;4311,S_DATA\n");
  const snap = loadSnapshot("2026-01-01", tmp);
  const role = snap.roles.get("JOB_AP");
  assert.equal(role.onet_code, "43-3031.00");
  assert.equal(role.esco_uri, "http://esco/x");
  assert.equal(role.isco_code, "4311");
  fs.rmSync(tmp, { recursive: true, force: true });
});

// A copy of the newer test snapshot, changed by `edit(folder)`, for testing files Darishka may or may not send.
async function changedCopy(edit) {
  const { default: fs } = await import("node:fs");
  const { default: os } = await import("node:os");
  const { default: path } = await import("node:path");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "snap-"));
  const folder = path.join(tmp, "2026-01-01");
  fs.cpSync(path.join(DIR, "2026-10-20"), folder, { recursive: true });
  edit(folder, fs, path);
  const snap = loadSnapshot("2026-01-01", tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  return snap;
}

test("without task_skills.csv, each task gets its job's skills from roles.csv", async () => {
  const snap = await changedCopy((folder, fs, path) => fs.rmSync(path.join(folder, "task_skills.csv")));
  assert.equal(snap.skillLinks, "job");
  assert.deepEqual(snap.taskSkills.get("TASK_1"), ["S_DATA", "S_RECON", "S_COMM", "S_INVEST", "S_NEGOT"]);
  assert.equal(now.skillLinks, "task");
});

test("a task with no row in task_skills.csv falls back to its job's skills", async () => {
  const snap = await changedCopy((folder, fs, path) => {
    const file = path.join(folder, "task_skills.csv");
    const kept = fs.readFileSync(file, "utf8").split("\n").filter((line) => !line.startsWith("TASK_9,"));
    fs.writeFileSync(file, kept.join("\n"));
  });
  assert.equal(snap.skillLinks, "task");
  assert.deepEqual(snap.taskSkills.get("TASK_9"), ["S_MODEL", "S_PRES", "S_RECON", "S_COMM"]);
});

test("with job_skills.csv, a task link may also use the job's optional ESCO skills", async () => {
  const snap = await changedCopy((folder, fs, path) => {
    fs.writeFileSync(path.join(folder, "job_skills.csv"), "job_id,skill_id,relation\nJOB_AP,S_MODEL,optional\n");
    fs.appendFileSync(path.join(folder, "task_skills.csv"), "\nTASK_1,S_MODEL,false,team\nTASK_1,S_PRES,false,team\n");
  });
  assert.ok(snap.taskSkills.get("TASK_1").includes("S_MODEL"));
  assert.ok(!snap.taskSkills.get("TASK_1").includes("S_PRES"));
  assert.ok(snap.warnings.some((w) => w.includes("TASK_1 -> S_PRES")));
});

test("a skill in several ESCO groups is read as a list", async () => {
  const snap = await changedCopy((folder, fs, path) => {
    fs.writeFileSync(path.join(folder, "skills.csv"), "skill_id,skill_name,group_uri\nS_DATA,data entry,g/a;g/b\nS_RECON,reconcile,\n");
  });
  assert.deepEqual(snap.skills.get("S_DATA").group_uri, ["g/a", "g/b"]);
  assert.deepEqual(snap.skills.get("S_RECON").group_uri, []);
});

test("SDG links: 'no' is hidden, both minus signs work, any other sign is dropped", async () => {
  const snap = await changedCopy((folder, fs, path) => fs.writeFileSync(path.join(folder, "sdg_links.csv"),
    "item_type,item_id,sdg_target,sign,is_estimate,reviewed,source\n" +
    "role,JOB_AUD,8.5,+,true,,test_onet\n" +
    "role,JOB_AUD,12.2,−,true,yes,test_onet\n" +
    "role,JOB_ANL,4.4,+,true,no,test_onet\n" +
    "role,JOB_ANL,8.2,?,true,,test_onet\n"));
  assert.deepEqual(snap.sdgLinks.map((l) => [l.sdg_target, l.sign]), [["8.5", "+"], ["12.2", "-"]]);
  assert.ok(snap.warnings.some((w) => w.includes('sign "?"')));
});

test("a person with no current job has a target job and their own skills", () => {
  const grad = now.users.get("grad");
  assert.equal(grad.current_job, null);
  assert.equal(grad.target_job, "JOB_AUD");
  assert.deepEqual(grad.skill_ids, ["S_COMM", "S_REPORT"]);
  assert.deepEqual(grad.tasks, []);
});
