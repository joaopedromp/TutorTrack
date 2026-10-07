import { Field, Modal } from "./FormParts";
import { SettingsPage } from "./SettingsPage";
import { useAppData } from "./useAppData";
import { SessionsPage } from "./SessionsPage";
import { StudentProfile } from "./StudentProfile";
import { prepareCompletionSound, playCompletionSound } from "./completionSound";
import { CompletionStatus } from "./CompletionStatus";
import { PaymentStatus } from "./StatusButtons";
import { PaycheckReminder } from "./PaycheckReminder";
import { filterUpcoming } from "./dashboard";
import { CalendarSync } from "./CalendarSync";
import { CoursePicker } from "./CoursePicker";
import { SessionSchedule } from "./SessionSchedule";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  LayoutDashboard,
  NotebookPen,
  Users,
  Wallet,
  Settings as SettingsIcon,
  Plus,
  ChevronRight,
  Clock,
  Check,
  X,
  Search,
  Trash2,
  BookOpen,
} from "lucide-react";
import {
  isActivity,
  periodTotals,
  courseLabel,
  type Course,
  nextPaycheck,
  saveSessionEntry,
  db,
  uid,
  now,
  initialize,
  localDate,
  totals,
  money,
  hours,
  fmtDate,
  fmtTime,
  duration,
  studentSchema,
  deleteSession,
  type Student,
  type Session,
  type Period,
  type Payment,
  type Settings,
} from "./data";

type Page = "Dashboard" | "Sessions" | "Students" | "Payroll" | "Settings";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Sessions", NotebookPen],
  ["Students", Users],
  ["Payroll", Wallet],
  ["Settings", SettingsIcon],
] as const;
function Empty({
  text,
  action,
  click,
}: {
  text: string;
  action?: string;
  click?: () => void;
}) {
  return (
    <div className="empty">
      <BookOpen size={26} />
      <p>{text}</p>
      {action && (
        <button onClick={click} className="secondary">
          {action}
          <Plus size={15} />
        </button>
      )}
    </div>
  );
}
export default function App() {
  const periodHourTarget: number | null = 40;
  const [upcomingFilter, setUpcomingFilter] = useState<"one" | "walk" | "all">(
    "all",
  );
  const [page, setPage] = useState<Page>("Dashboard");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [studentEdit, setStudentEdit] = useState<Student | "new" | null>(null);
  const [sessionEdit, setSessionEdit] = useState<Session | "new" | null>(null);
  const [profile, setProfile] = useState<Student | null>(null);
  const [payEdit, setPayEdit] = useState<Period | null>(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const data = useAppData();
  useEffect(() => {
    initialize().catch((e) => setError(String(e)));
  }, []);
  async function act(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  if (!data) return <div className="loading">Opening TutorTrack…</div>;
  const {
    students,
    courses,
    sessions,
    periods,
    payments,
    settings,
    studentById,
    courseById,
    byStudent,
    byPeriod,
    completedMinutes,
  } = data;
  const studentName = (s: Session) =>
    studentById.get(s.studentId)?.name || "Assign student";
  const courseName = (id: string) => courseLabel(courseById.get(id));
  const today = localDate(new Date());
  const current = periods.find((p) => p.start <= today && p.end >= today);
  const periodSessions = (p: Period) => byPeriod.get(p.id) || [];
  const periodTotal = current
    ? periodTotals(periodSessions(current), settings, current)
    : totals([], settings);
  const upcoming = sessions
    .filter(
      (s) =>
        s.status === "scheduled" && !s.eventCancelled && s.scheduledEnd > now(),
    )
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const visibleUpcoming = filterUpcoming(
    upcoming,
    courses,
    upcomingFilter,
    students,
  );
  const upcomingDays = [
    ...new Set(visibleUpcoming.map((s) => localDate(s.scheduledStart))),
  ];
  const paycheck = nextPaycheck(sessions, periods, payments, settings, today);
  const paymentStatus = (p: Period) => {
    const saved = payments.find((x) => x.periodId === p.id);
    return saved?.status === "paid" ? "paid" : "upcoming";
  };
  const openPage = (p: Page) => {
    setPage(p);
    setSearch("");
    setProfile(null);
  };
  const list = (ss: Session[], empty = "No sessions yet") => (
    <div className="session-list">
      {ss.length ? (
        ss.map((s) => (
          <button
            className="session-row"
            key={s.id}
            onClick={() => setSessionEdit(s)}
          >
            <span className={"status-icon " + s.status}>
              {s.status === "completed" ? (
                <Check size={17} />
              ) : s.status === "cancelled" ? (
                <X size={17} />
              ) : (
                <Clock size={17} />
              )}
            </span>
            <span className="session-person">
              <strong>{studentName(s)}</strong>
              <small>
                {page === "Dashboard" ? (
                  courseById.get(s.courseId)?.code || courseName(s.courseId)
                ) : (
                  <>
                    {courseName(s.courseId)}
                    {s.topics ? " · " + s.topics : ""}
                  </>
                )}
              </small>
            </span>
            <span className="session-date">
              {fmtDate(s.scheduledStart)}
              <small>
                {fmtTime(s.scheduledStart)} – {fmtTime(s.scheduledEnd)}
              </small>
            </span>
            {page !== "Dashboard" && (
              <span className="session-pay">
                {s.status !== "completed" && (
                  <span className={"badge " + s.status}>{s.status}</span>
                )}
                <small>
                  {s.status === "completed"
                    ? hours(duration(s.actualStart, s.actualEnd)) + " h actual"
                    : hours(duration(s.scheduledStart, s.scheduledEnd)) +
                      " h scheduled"}
                </small>
              </span>
            )}
            <ChevronRight size={16} />
          </button>
        ))
      ) : (
        <Empty
          text={empty}
          action={page === "Students" && profile ? undefined : "Add session"}
          click={() => setSessionEdit("new")}
        />
      )}
    </div>
  );
  return (
    <div className="app">
      <aside>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            openPage("Dashboard");
          }}
        >
          <span className="brand-icon">
            <BookOpen size={21} />
          </span>
          TutorTrack
        </a>
        <nav>
          {nav.map(([p, Icon]) => (
            <button
              key={p}
              title={p}
              onClick={() => openPage(p)}
              className={page === p ? "selected" : ""}
              aria-current={page === p ? "page" : undefined}
            >
              <Icon size={19} />
              {p}
            </button>
          ))}
        </nav>
      </aside>
      <main>
        <header className="page-header">
          <div>
            <div className="eyebrow">
              {new Date().toLocaleDateString("en-CA", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
            <div className="page-title-row">
              <h1>{page}</h1>
              {page === "Students" && (
                <button
                  type="button"
                  className="student-add-icon"
                  aria-label="Add student"
                  title="Add student"
                  onClick={() => setStudentEdit("new")}
                >
                  <Plus size={14} />
                </button>
              )}
              {page === "Sessions" && (
                <button
                  type="button"
                  className="student-add-icon"
                  aria-label="Add session"
                  title="Add session"
                  onClick={() => setSessionEdit("new")}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="header-actions">
            {page === "Dashboard" && paycheck && (
              <PaycheckReminder
                date={fmtDate(paycheck.period.pay)}
                amount={money(paycheck.net)}
                onOpen={() => setPayEdit(paycheck.period)}
              />
            )}
          </div>
        </header>
        {error && (
          <div className="alert" role="alert">
            {error}
            <button
              className="icon"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {page === "Dashboard" && (
          <div className="dashboard-content dashboard-refreshed">
            <section
              className="panel dashboard-summary current-pay-summary"
              aria-label="Current pay period"
            >
              <div>
                <span className="eyebrow">CURRENT PAY PERIOD</span>
                <h2>
                  {current
                    ? fmtDate(current.start) + " – " + fmtDate(current.end)
                    : "No current pay period"}
                </h2>
                <p className="hint">{hours(periodTotal.mins)} hours worked</p>
              </div>
              <div className="summary-amount">
                <strong>{money(periodTotal.net)}</strong>
                <span>Take-home</span>
                <small>
                  {settings.deduction}% deductions · {money(settings.wage)} /
                  hour
                </small>
              </div>
              {periodHourTarget !== null && (
                <div className="period-progress">
                  <div>
                    <span>{Number(hours(periodTotal.mins))}h logged</span>
                    <span>{periodHourTarget}h max</span>
                  </div>
                  <progress
                    aria-label="Logged hours in current pay period"
                    max={periodHourTarget}
                    value={Math.min(periodHourTarget, periodTotal.mins / 60)}
                  />
                </div>
              )}
            </section>
            <div className="dashboard-bottom">
              <section className="panel next-panel">
                <div className="section-line">
                  <div className="upcoming-title">
                    <h2>Upcoming</h2>
                    <button
                      type="button"
                      className="upcoming-add"
                      title="Add session"
                      aria-label="Add session"
                      onClick={() => setSessionEdit("new")}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <CalendarSync
                    compact
                    onConnect={() => openPage("Settings")}
                  />
                </div>
                <div
                  className="upcoming-filters"
                  role="group"
                  aria-label="Upcoming session type"
                >
                  {(["all", "one", "walk"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={upcomingFilter === value}
                      onClick={() => setUpcomingFilter(value)}
                    >
                      {value === "one"
                        ? "1-on-1"
                        : value === "walk"
                          ? "Walk-in"
                          : "All"}
                    </button>
                  ))}
                </div>
                <div className="upcoming-agenda">
                  {upcomingDays.length ? (
                    upcomingDays.map((day) => (
                      <div className="agenda-day" key={day}>
                        <h3>
                          {day === today
                            ? "Today"
                            : new Date(day + "T12:00:00").toLocaleDateString(
                                "en-CA",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                        </h3>
                        {visibleUpcoming
                          .filter((s) => localDate(s.scheduledStart) === day)
                          .map((s) => (
                            <button
                              className="agenda-session"
                              key={s.id}
                              onClick={() => setSessionEdit(s)}
                            >
                              <span className="agenda-time">
                                {fmtTime(s.scheduledStart)}
                                <small>{fmtTime(s.scheduledEnd)}</small>
                              </span>
                              <span>
                                <strong>{studentName(s)}</strong>
                                <small>
                                  {courseById.get(s.courseId)?.code ||
                                    courseName(s.courseId)}
                                </small>
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          ))}
                      </div>
                    ))
                  ) : (
                    <div className="agenda-empty">
                      {upcomingFilter === "one"
                        ? "No upcoming student sessions"
                        : upcomingFilter === "walk"
                          ? "No upcoming walk-in sessions"
                          : "No upcoming sessions"}
                    </div>
                  )}
                </div>
              </section>
              <section className="panel recent-panel">
                <div className="section-line">
                  <h2>Recent</h2>
                  <button
                    className="text-button"
                    onClick={() => openPage("Sessions")}
                  >
                    View all
                    <ChevronRight size={15} />
                  </button>
                </div>
                {list(
                  sessions
                    .filter((s) => s.status === "completed")
                    .sort((a, b) => b.actualStart.localeCompare(a.actualStart))
                    .slice(0, 2),
                  "No completed sessions yet",
                )}
              </section>
            </div>
          </div>
        )}
        {page === "Sessions" && (
          <SessionsPage
            sessions={sessions}
            students={students}
            courses={courses}
            onOpen={setSessionEdit}
          />
        )}
        {page === "Students" && (
          <>
            {profile ? (
              <StudentProfile
                student={studentById.get(profile.id) || profile}
                sessions={byStudent.get(profile.id) || []}
                students={students}
                courses={courses}
                onBack={() => setProfile(null)}
                onEdit={() =>
                  setStudentEdit(studentById.get(profile.id) || profile)
                }
                onOpen={setSessionEdit}
              />
            ) : (
              <>
                <div className="filters">
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Search students"
                      placeholder="Search students"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    Include archived
                  </label>
                </div>
                {[false, true].map((activity) => {
                  const filtered = students
                    .filter(
                      (s) =>
                        (showArchived || !s.archived) &&
                        s.name.toLowerCase().includes(search.toLowerCase()) &&
                        isActivity(s) === activity,
                    )
                    .sort((a, b) => a.name.localeCompare(b.name));
                  return (
                    filtered.length > 0 && (
                      <section
                        className="compact-student-section"
                        key={String(activity)}
                      >
                        <h2 className="student-group-heading">
                          {activity ? "Activities" : "Students"} ·{" "}
                          {filtered.length}
                        </h2>
                        <div className="compact-student-grid">
                          {filtered.map((s) => (
                            <button
                              className="compact-student-card"
                              key={s.id}
                              onClick={() => setProfile(s)}
                            >
                              <span className="compact-student-avatar">
                                {s.name
                                  .split(" ")
                                  .map((v) => v[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              <span className="compact-student-body">
                                <strong>{s.name}</strong>
                                <small>
                                  {Number(
                                    hours(completedMinutes.get(s.id) || 0),
                                  )}{" "}
                                  h completed{s.archived ? " · Archived" : ""}
                                </small>
                              </span>
                              <ChevronRight size={14} aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      </section>
                    )
                  );
                })}
                {!students.filter(
                  (s) =>
                    (showArchived || !s.archived) &&
                    s.name.toLowerCase().includes(search.toLowerCase()),
                ).length && (
                  <section className="panel">
                    <Empty
                      text="Keep your students and session history together"
                      action="Add student"
                      click={() => setStudentEdit("new")}
                    />
                  </section>
                )}
              </>
            )}
          </>
        )}
        {page === "Payroll" && (
          <>
            <div className="section-line">
              <h2>Payroll periods</h2>
              <span className="muted">
                {[...new Set(periods.map((p) => p.start.slice(0, 4)))]
                  .sort()
                  .join(" / ")}{" "}
                · CAD
              </span>
            </div>
            <section className="panel table-panel">
              <table>
                <thead>
                  <tr>
                    <th>Covered dates</th>
                    <th>Hours</th>
                    <th>Gross</th>
                    <th>Est. take-home</th>
                    <th>Pay date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {periods
                    .slice()
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((p) => {
                      const t = periodTotals(periodSessions(p), settings, p);
                      return (
                        <tr key={p.id}>
                          <td>
                            <button
                              className="cell-button"
                              onClick={() => setPayEdit(p)}
                            >
                              {fmtDate(p.start)} – {fmtDate(p.end)}
                            </button>
                          </td>
                          <td>{hours(t.mins)}</td>
                          <td>
                            {money(t.gross)}
                            <small>{money(t.deductions)} est. deductions</small>
                          </td>
                          <td>{money(t.net)}</td>
                          <td>
                            <strong className="pay-date">
                              Pay {fmtDate(p.pay)}
                            </strong>
                            <small>Submit {fmtDate(p.submit)}</small>
                          </td>
                          <td>
                            <PaymentStatus
                              periodId={p.id}
                              value={paymentStatus(p)}
                              label={
                                "Payment status for " +
                                fmtDate(p.start) +
                                " – " +
                                fmtDate(p.end)
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </section>
          </>
        )}
        {page === "Settings" && (
          <SettingsPage settings={settings} act={act} notify={setNotice} />
        )}
      </main>
      {studentEdit && (
        <StudentForm
          student={studentEdit}
          close={() => setStudentEdit(null)}
          after={(s) => {
            if (profile?.id === s.id) setProfile(s.archived ? null : s);
          }}
        />
      )}
      {sessionEdit && (
        <SessionForm
          session={sessionEdit}
          close={() => setSessionEdit(null)}
          students={students}
          courses={courses}
          settings={settings}
        />
      )}
      {payEdit && (
        <PaymentForm
          period={periods.find((p) => p.id === payEdit.id) || payEdit}
          payment={payments.find((p) => p.periodId === payEdit.id)}
          settings={settings}
          sessions={periodSessions(payEdit)}
          close={() => setPayEdit(null)}
          sessionList={list}
        />
      )}
    </div>
  );
}
function StudentForm({
  student,
  close,
  after,
}: {
  student: Student | "new";
  close: () => void;
  after: (s: Student) => void;
}) {
  const courses = useLiveQuery(() => db.courses.toArray()) || [];
  const original = student === "new" ? null : student;
  const [name, setName] = useState(original?.name || "");
  const [course, setCourse] = useState(original?.courseId || "");
  const [note, setNote] = useState(original?.note || "");
  const [kind, setKind] = useState<"student" | "activity">(
    original && isActivity(original) ? "activity" : "student",
  );
  const [archived, setArchived] = useState(original?.archived || false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await db.transaction("rw", db.students, db.courses, async () => {
        const s = studentSchema.parse({
          ...original,
          id: original?.id || uid(),
          name,
          courseId: course,
          kind,
          note,
          archived,
          createdAt: original?.createdAt || now(),
        });
        await db.students.put(s);
        after(s);
      });
      close();
    } catch (e) {
      setError(String(e));
    }
  }
  async function remove() {
    try {
      const count = await db.sessions
        .where("studentId")
        .equals(original!.id)
        .count();
      if (count) {
        if (
          confirm(
            "This student has session history. Archive the student and preserve all history?",
          )
        ) {
          const s = { ...original!, archived: true };
          await db.students.put(s);
          after(s);
          close();
        }
      } else if (confirm("Delete this student? This cannot be undone.")) {
        await db.students.delete(original!.id);
        after({ ...original!, archived: true });
        close();
      }
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <Modal title={original ? "Edit student" : "Add student"} close={close}>
      <form onSubmit={save}>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Field label="Student name">
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Type">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "student" | "activity")}
          >
            <option value="student">Student</option>
            <option value="activity">Activity</option>
          </select>
        </Field>
        <Field label="Short note">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </Field>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          Archived
        </label>
        {original && (
          <p className="hint">Created {fmtDate(original.createdAt)}</p>
        )}
        <footer>
          {original && (
            <button className="danger" type="button" onClick={remove}>
              <Trash2 size={18} />
              Remove student
            </button>
          )}
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary">Save student</button>
        </footer>
      </form>
    </Modal>
  );
}
function SessionForm({
  session,
  close,
  students,
  courses,
  settings,
}: {
  session: Session | "new";
  close: () => void;
  students: Student[];
  courses: Course[];
  settings: Settings;
  syncRecord?: { eventId: string; syncedAt: string };
}) {
  const original = session === "new" ? undefined : session;
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const [s, setS] = useState<Session>(
    () =>
      original || {
        id: uid(),
        studentId: "",
        courseId: "",
        title: "Tutoring",
        scheduledStart: start.toISOString(),
        scheduledEnd: new Date(+start + 3600000).toISOString(),
        actualStart: "",
        actualEnd: "",
        topics: "",
        notes: "",
        status: "scheduled",
        eventCancelled: false,
        updatedAt: now(),
        scheduleUpdatedAt: now(),
        deleted: false,
      },
  );
  const adjustHours =
    !!original &&
    !!(original.actualStart || original.actualEnd) &&
    (original.actualStart !== original.scheduledStart ||
      original.actualEnd !== original.scheduledEnd);
  const initial = useRef(s);
  const [addingStudent, setAddingStudent] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty =
    JSON.stringify(initial.current) !== JSON.stringify(s) || addingStudent;
  const requestClose = () => {
    if (!saving && (!dirty || confirm("Discard unsaved session changes?")))
      close();
  };
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const set = (k: keyof Session, v: unknown) =>
    setS((prev) => ({ ...prev, [k]: v }));
  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const completed =
      s.status === "completed" && original?.status !== "completed";
    if (completed) prepareCompletionSound();
    try {
      await saveSessionEntry(
        s,
        adjustHours,
        addingStudent ? { name: newName, courseId: newCourse } : undefined,
        original,
      );
      if (completed) playCompletionSound();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      title={original ? "Session details" : "Add session"}
      close={requestClose}
    >
      <form onSubmit={save}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="student-choice-label">
          <label htmlFor="session-student">
            {addingStudent ? "New student" : "Student / activity"}
          </label>
          <button
            type="button"
            className="icon"
            title={addingStudent ? "Choose existing student" : "Add student"}
            aria-label={
              addingStudent ? "Choose existing student" : "Add student"
            }
            onClick={() => setAddingStudent(!addingStudent)}
          >
            {addingStudent ? <X size={15} /> : <Plus size={15} />}
          </button>
        </div>
        {addingStudent ? (
          <>
            <Field label="New student name">
              <input
                id="session-student"
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
            <CoursePicker
              courses={courses}
              value={newCourse}
              onChange={setNewCourse}
            />
          </>
        ) : (
          <>
            <div className="student-choice">
              <select
                id="session-student"
                aria-label="Student / activity"
                required
                value={s.studentId}
                onChange={(e) => {
                  const studentId = e.target.value;
                  setS((prev) => ({ ...prev, studentId }));
                  void db.sessions
                    .where("studentId")
                    .equals(studentId)
                    .toArray()
                    .then((history) => {
                      const recent = history
                        .filter((x) => !x.deleted)
                        .sort((a, b) =>
                          b.scheduledStart.localeCompare(a.scheduledStart),
                        )[0];
                      const fallback = students.find(
                        (x) => x.id === studentId,
                      )?.courseId;
                      const courseId =
                        courses.find(
                          (c) =>
                            c.id === (recent?.courseId || fallback) &&
                            !c.archived,
                        )?.id || "";
                      setS((prev) =>
                        prev.studentId === studentId
                          ? { ...prev, courseId }
                          : prev,
                      );
                    })
                    .catch(() =>
                      setError(
                        "Could not load the last course. Choose a course below.",
                      ),
                    );
                }}
              >
                <option value="">Choose student</option>
                {students
                  .filter((x) => !x.archived || x.id === s.studentId)
                  .map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.name}
                      {x.archived ? " (archived)" : ""}
                    </option>
                  ))}
              </select>
            </div>
            <CoursePicker
              courses={courses}
              value={s.courseId}
              onChange={(id) => set("courseId", id)}
            />
          </>
        )}
        <SessionSchedule
          start={s.scheduledStart}
          end={s.scheduledEnd}
          onChange={(scheduledStart, scheduledEnd) =>
            setS((prev) => ({ ...prev, scheduledStart, scheduledEnd }))
          }
        />
        <div className="compact-status-field">
          <span>Status</span>
          <CompletionStatus
            label="Session status"
            sound={false}
            done={s.status === "completed"}
            before="Scheduled"
            after="Completed"
            onChange={(done) => set("status", done ? "completed" : "scheduled")}
          />
        </div>

        <footer>
          {original && (
            <button
              type="button"
              className="icon danger"
              aria-label="Delete session"
              title="Delete session"
              disabled={saving}
              onClick={async () => {
                if (confirm("Delete this session and its recorded hours?")) {
                  try {
                    await deleteSession(original);
                    close();
                  } catch (e) {
                    setError(String(e));
                  }
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" disabled={saving} onClick={requestClose}>
            Cancel
          </button>
          <button className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save session"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}

function PaymentForm({
  period,
  payment,
  settings,
  sessions,
  close,
  sessionList,
}: {
  period: Period;
  payment?: Payment;
  settings: Settings;
  sessions: Session[];
  close: () => void;
  sessionList: (ss: Session[]) => ReactNode;
}) {
  const t = periodTotals(sessions, settings, period);
  return (
    <Modal
      title={fmtDate(period.start) + " – " + fmtDate(period.end)}
      close={close}
    >
      <p className="compact-pay-date">
        Pay {fmtDate(period.pay)} · Submit {fmtDate(period.submit)}
      </p>
      <div className="compact-payment-summary">
        <div>
          <span>Hours worked</span>
          <strong>{hours(t.mins)}</strong>
          <small>{money(t.gross)} gross</small>
        </div>
        <div>
          <span>Take-home</span>
          <strong className="takehome">{money(t.net)}</strong>
          <small>{money(t.deductions)} deductions</small>
        </div>
      </div>
      <div className="compact-status-field">
        <span>Payment status</span>
        <PaymentStatus
          periodId={period.id}
          value={payment?.status === "paid" ? "paid" : "upcoming"}
          label="Payment status"
        />
      </div>
      <details className="included-sessions">
        <summary>
          Included sessions <span>{sessions.length} sessions</span>
        </summary>
        {sessionList(sessions)}
      </details>
    </Modal>
  );
}
