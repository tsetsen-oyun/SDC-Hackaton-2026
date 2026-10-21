export default function WeekBar({ tasks, doneIds }) {
  return (
    <div className="weekbar">
      {tasks.map((t) => {
        const done = doneIds?.has(t.task_id);
        return (
          <div
            key={t.task_id}
            className={"block " + (done ? "hatched" : "human")}
            style={{ flex: `${t.hours} 1 0` }}
            title={t.name}
          >
            <span className="block-name">{t.name}</span>
            <small>{t.hours} h</small>
          </div>
        );
      })}
    </div>
  );
}