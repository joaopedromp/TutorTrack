import { localDate, duration, fmtTime, shiftSessionStart } from "./data";

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
  const length = duration(start, end) / 60;
  function moveStart(d: Date) {
    const next = shiftSessionStart(start, end, d.toISOString());
    onChange(next.start, next.end);
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
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-").map(Number);
              const next = new Date(start);
              next.setFullYear(y, m - 1, d);
              moveStart(next);
            }}
          />
        </label>
      </div>
      <div className="time-grid">
        <TimeSelect
          label={label + " start"}
          value={start}
          onChange={(h, m) => {
            const next = new Date(start);
            next.setHours(h, m, 0, 0);
            moveStart(next);
          }}
        />
        <label>
          Duration (hours)
          <input
            aria-label={label + " duration in hours"}
            required
            type="number"
            min="0.25"
            step="any"
            value={length || ""}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isFinite(value) && value >= 0)
                onChange(
                  start,
                  new Date(Date.parse(start) + value * 3600000).toISOString(),
                );
            }}
          />
        </label>
      </div>
      <p className="hint">
        Ends at {fmtTime(end)}
        {localDate(start) !== localDate(end) ? " · " + localDate(end) : ""}
      </p>
    </div>
  );
}
