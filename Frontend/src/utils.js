export const personTasks = (p) => (p?.tasks?.length ? p.tasks : p?.target_job_tasks ?? []);
export const toPayload = (tasks) => tasks.map(({ task_id, hours }) => ({ task_id, hours }));
export const rangeLabel = (from, to) =>
  to == null ? `After ${from - 1}` : from === to ? `${from}` : `${from}–${to}`;
export const SCENARIO_LABEL = { moderate: "normal-pace", fast: "fast-pace", slowdown: "slowdown" };