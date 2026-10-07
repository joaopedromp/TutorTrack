import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Upload, Trash2, RefreshCw } from "lucide-react";
import { Field, Modal } from "./FormParts";
import { PayrollSchedule } from "./PayrollScheduleEditor";
import { safetyBackup } from "./safetyBackup";
import { CalendarSync } from "./CalendarSync";
import {
  db,
  saveEarnings,
  settingsSchema,
  exportData,
  localDate,
  now,
  validateBackup,
  importData,
  initialize,
  removeCourse,
  courseLabel,
  type Settings,
} from "./data";
export function SettingsPage({
  settings,
  act,
  notify,
}: {
  settings: Settings;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  notify: (s: string) => void;
}) {
  const [wage, setWage] = useState(settings.wage.toString());
  const [deduction, setDeduction] = useState(settings.deduction.toString());
  const input = useRef<HTMLInputElement>(null);
  const [clear, setClear] = useState(false);
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    setWage(String(settings.wage));
    setDeduction(String(settings.deduction));
  }, [settings.wage, settings.deduction]);
  return (
    <div className="settings-grid settings-clean settings-minimal">
      <section className="panel settings-earnings">
        <h2>Earnings</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const value = settingsSchema.parse({
                ...settings,
                wage: Number(wage),
                deduction: Number(deduction),
                deductionBasis:
                  deduction === String(settings.deduction)
                    ? settings.deductionBasis
                    : "manual",
              });
              await saveEarnings(value);
              notify("Earnings settings saved");
            });
          }}
        >
          <div className="form-grid">
            <Field label="Hourly wage (CAD)">
              <input
                required
                type="number"
                min="0"
                max="10000"
                step="0.0001"
                value={wage}
                onChange={(e) => setWage(e.target.value)}
              />
            </Field>
            <Field label="Deductions (%)">
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={deduction}
                onChange={(e) => setDeduction(e.target.value)}
              />
            </Field>
          </div>
          <button className="primary">Save</button>
        </form>
      </section>
      <section className="panel settings-google">
        <h2>Google Calendar</h2>
        <CalendarSync />
      </section>
      <section className="panel settings-backup">
        <h2>Backup &amp; restore</h2>
        <p className="hint">
          Restoring a backup replaces your current records.
        </p>
        <div className="inline">
          <button
            onClick={() =>
              act(async () => {
                const b = await exportData();
                const saved = await window.tutortrack.saveBackup(
                  JSON.stringify(b, null, 2),
                  "TutorTrack-" + localDate(new Date()) + ".json",
                );
                if (!saved) return;
                await db.settings.update("settings", { lastBackup: now() });
                notify("Backup saved");
              })
            }
          >
            <Download size={16} />
            Export
          </button>
          <button onClick={() => input.current?.click()}>
            <Upload size={16} />
            Restore
          </button>
        </div>
        <input
          hidden
          ref={input}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              void act(async () => {
                if (file.size > 50 * 1024 * 1024)
                  throw Error("Backup exceeds 50 MB.");
                const b = validateBackup(JSON.parse(await file.text()));
                if (
                  confirm(
                    `Replace all local data with this backup? It contains ${b.students.length} students and ${b.sessions.length} sessions. Existing records will be replaced.`,
                  )
                ) {
                  await safetyBackup();
                  await importData(b);
                  notify("Backup restored.");
                }
              });
          }}
        />
        <p className="hint">
          Last backup:{" "}
          {settings.lastBackup
            ? new Date(settings.lastBackup).toLocaleString()
            : "Not yet backed up"}
        </p>
      </section>
      <CourseManagement />
      <PayrollSchedule />
      <details className="settings-data">
        <summary>Advanced</summary>
        <div>
          <p className="hint">
            Clearing records cannot be undone without a backup.
          </p>
        </div>
        <button className="danger" onClick={() => setClear(true)}>
          <Trash2 size={16} />
          Clear all local data
        </button>
      </details>
      {clear && (
        <Modal title="Clear all local data?" close={() => setClear(false)}>
          <p>
            All students, sessions, payments, and settings on this device will
            be removed. This cannot be undone without a backup.
          </p>
          <Field label="Type CLEAR to confirm">
            <input
              autoFocus
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
          </Field>
          <footer>
            <button onClick={() => setClear(false)}>Cancel</button>
            <button
              className="danger"
              disabled={phrase !== "CLEAR"}
              onClick={() =>
                act(async () => {
                  await safetyBackup();
                  await db.transaction("rw", db.tables, async () => {
                    for (const table of db.tables) await table.clear();
                  });
                  await initialize();
                  setClear(false);
                  notify("Local data cleared");
                })
              }
            >
              Clear data
            </button>
          </footer>
        </Modal>
      )}
    </div>
  );
}

function CourseManagement() {
  const courses = useLiveQuery(() => db.courses.toArray()) || [];
  const [showRemoved, setShowRemoved] = useState(false);
  const [courseSearch, setCourseSearch] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="panel settings-courses">
      <summary>Courses</summary>
      <input
        className="course-management-search"
        aria-label="Search courses to remove"
        placeholder="Search course name or code"
        value={courseSearch}
        onChange={(e) => setCourseSearch(e.target.value)}
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={showRemoved}
          onChange={(e) => setShowRemoved(e.target.checked)}
        />
        Show removed courses
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="settings-course-list">
        {courses
          .filter(
            (c) =>
              (showRemoved || !c.archived) &&
              courseLabel(c)
                .toLowerCase()
                .includes(courseSearch.trim().toLowerCase()),
          )
          .map((c) => (
            <div className="section-line" key={c.id}>
              <span>{courseLabel(c)}</span>
              <button
                type="button"
                aria-label={
                  (c.archived ? "Restore " : "Remove ") + courseLabel(c)
                }
                onClick={async () => {
                  try {
                    if (c.archived)
                      await db.courses.update(c.id, { archived: false });
                    else if (
                      confirm(
                        "Remove " +
                          courseLabel(c) +
                          " from course choices? Existing sessions will be kept.",
                      )
                    )
                      await removeCourse(c.id);
                  } catch (e) {
                    setError(String(e));
                  }
                }}
                title={c.archived ? "Restore course" : "Remove course"}
              >
                {c.archived ? <RefreshCw size={15} /> : <Trash2 size={15} />}
              </button>
            </div>
          ))}
      </div>
    </details>
  );
}
