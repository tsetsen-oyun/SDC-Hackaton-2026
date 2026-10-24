// The week as one bar: each task is a block as wide as its hours.
// Each block carries the number of its task in the list below (hover for the full name).
// Hatched blue = AI could do it by the chosen year, dark = still human.
export default function WeekBar({ tasks, doneIds = new Set() }) {
  const shown = tasks.filter((t) => t.hours > 0);
  return (
    <div className="weekbar">
      {shown.map((t, i) => {
        const done = doneIds.has(t.task_id);
        return (
          <div
            key={t.task_id}
            className={"block " + (done ? "hatched" : "human")}
            style={{ flex: `${t.hours} 1 0` }}
            title={`${t.name} · ${t.hours} h`}
          >
            <span className="block-name block-num" aria-hidden="true">{i + 1}</span>
            <small>{t.hours} h</small>
          </div>
        );
      })}
    </div>
  );
}