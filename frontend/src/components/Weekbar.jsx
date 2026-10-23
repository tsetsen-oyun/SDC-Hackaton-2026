// The week as one bar: each task is a block as wide as its hours.
// Hatched blue = AI could do it by the chosen year, dark = still human.
export default function WeekBar({ tasks, doneIds = new Set() }) {
  const shown = tasks.filter((t) => t.hours > 0);
  return (
    <div className="weekbar">
      {shown.map((t) => {
        const done = doneIds.has(t.task_id);
        return (
          <div
            key={t.task_id}
            className={"block " + (done ? "hatched" : "human")}
            style={{ flex: `${t.hours} 1 0` }}
            title={`${t.name} · ${t.hours} h`}
          >
            <span className="block-name">{t.name}</span>
            <small>{t.hours} h</small>
          </div>
        );
      })}
    </div>
  );
}