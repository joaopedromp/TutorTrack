import { localDate, duration, hours } from "./data";

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hour: number, minute: number) => void;
}) {
  const d = new Date(value);
  const hour = d.getHours(),
    minute = d.getMinutes();
  return (
    <fieldset className="time-select">
      <legend>{label}</legend>
      <div className="time-controls">
        <select
          aria-label={label + " hour"}
          value={hour % 12 || 12}
          onChange={(e) =>
            onChange(
              (Number(e.target.value) % 12) + (hour >= 12 ? 12 : 0),
              minute,
            )
          }
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <span>:</span>
        <select
          aria-label={label + " minute"}
          value={minute}
          onChange={(e) => onChange(hour, Number(e.target.value))}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <option key={i} value={i}>
              {String(i).padStart(2, "0")}
            </option>
          ))}
        </select>
        <div className="time-period">
          <button
            type="button"
            aria-label={label + " AM"}
            aria-pressed={hour < 12}
            onClick={() => onChange(hour % 12, minute)}
          >
            AM
          </button>
          <button
            type="button"
            aria-label={label + " PM"}
            aria-pressed={hour >= 12}
            onClick={() => onChange((hour % 12) + 12, minute)}
          >
            PM
          </button>
        </div>
      </div>
    </fieldset>
  );
}
export function SessionSchedule({
  start,
  end,
  onChange,
  label = "Session",
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  label?: string;
}) {
  const separateDate = localDate(start) !== localDate(end);
  function setTime(which: "start" | "end", hour: number, minute: number) {
    const d = new Date(which === "start" ? start : end);
    d.setHours(hour, minute, 0, 0);
    onChange(
      which === "start" ? d.toISOString() : start,
      which === "end" ? d.toISOString() : end,
    );
  }
  function setDate(value: string, which: "start" | "end") {
    if (!value) return;
    const [year, month, day] = value.split("-").map(Number);
    const d = new Date(which === "start" ? start : end);
    d.setFullYear(year, month - 1, day);
    let nextEnd = end;
    if (which === "start" && !separateDate) {
      const e = new Date(end);
      e.setFullYear(year, month - 1, day);
      nextEnd = e.toISOString();
    }
    onChange(
      which === "start" ? d.toISOString() : start,
      which === "end" ? d.toISOString() : nextEnd,
    );
  }
  return (
    <div className="session-schedule">
      <div className="date-and-duration">
        <label>
          {label === "Session" ? "Date" : label + " date"}
          <input
            aria-label={label + " date"}
            required
            type="date"
            value={localDate(start)}
            onChange={(e) => setDate(e.target.value, "start")}
          />
        </label>
        <span className="duration-chip">
          {hours(Math.max(0, duration(start, end)))} hours
        </span>
      </div>
      <div className="time-grid">
        <TimeSelect
          label={label + " start"}
          value={start}
          onChange={(h, m) => setTime("start", h, m)}
        />
        <TimeSelect
          label={label + " end"}
          value={end}
          onChange={(h, m) => setTime("end", h, m)}
        />
      </div>
      <label className="checkbox overnight">
        <input
          type="checkbox"
          checked={separateDate}
          onChange={(e) => {
            const d = new Date(end);
            const s = new Date(start);
            d.setFullYear(
              s.getFullYear(),
              s.getMonth(),
              s.getDate() + (e.target.checked ? 1 : 0),
            );
            onChange(start, d.toISOString());
          }}
        />
        Ends on another day
      </label>
      {separateDate && (
        <label className="end-date">
          End date
          <input
            aria-label={label + " end date"}
            type="date"
            required
            value={localDate(end)}
            onChange={(e) => setDate(e.target.value, "end")}
          />
        </label>
      )}
      {duration(start, end) <= 0 && (
        <p className="form-error">End time must be later than start time.</p>
      )}
    </div>
  );
}
