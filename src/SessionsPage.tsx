import { useMemo, useState } from "react";
import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import {
  courseLabel,
  duration,
  fmtDate,
  fmtTime,
  hours,
  localDate,
  type Course,
  type Session,
  type Student,
} from "./data";
import { filterUpcoming, type UpcomingFilter } from "./dashboard";
import { compareSessions } from "./sessionOrder";
import { StatusButtons } from "./StatusButtons";

export function SessionAgenda({
  sessions,
  students,
  courses,
  onOpen,
  empty = "No matching sessions",
}: {
  sessions: Session[];
  students: Student[];
  courses: Course[];
  onOpen: (s: Session) => void;
  empty?: string;
}) {
  const studentById = useMemo(
    () => new Map(students.map((s) => [s.id, s])),
    [students],
  );
  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    const day = localDate(session.scheduledStart);
    const group = groups.get(day) || [];
    group.push(session);
    groups.set(day, group);
  }
  const today = localDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    <div className="session-agenda">
      {groups.size ? (
        [...groups].map(([day, items]) => (
          <section key={day} className="session-day">
            <h3>
              {day === today
                ? "Today · "
                : day === localDate(tomorrow)
                  ? "Tomorrow · "
                  : ""}
              {fmtDate(day)}
              {day.slice(0, 4) !== today.slice(0, 4)
                ? `, ${day.slice(0, 4)}`
                : ""}
            </h3>
            <div className="agenda-group">
              {items.map((s) => (
                <button
                  key={s.id}
                  className="compact-session-row"
                  onClick={() => onOpen(s)}
                >
                  <span className="row-time">
                    {fmtTime(s.scheduledStart)}
                    <small>{fmtTime(s.scheduledEnd)}</small>
                  </span>
                  <span className="row-person">
                    <strong>
                      {studentById.get(s.studentId)?.name || "Assign student"}
                    </strong>
                    <small>{courseLabel(courseById.get(s.courseId))}</small>
                  </span>
                  <span className={"row-duration " + s.status}>
                    {Number(
                      hours(
                        duration(
                          s.status === "completed"
                            ? s.actualStart
                            : s.scheduledStart,
                          s.status === "completed"
                            ? s.actualEnd
                            : s.scheduledEnd,
                        ),
                      ),
                    )}{" "}
                    h
                    <small>
                      {s.status === "completed"
                        ? "Completed"
                        : s.status === "cancelled"
                          ? "Cancelled"
                          : "Scheduled"}
                    </small>
                  </span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="agenda-empty">{empty}</p>
      )}
    </div>
  );
}

export function SessionsPage({
  sessions,
  students,
  courses,
  onOpen,
}: {
  sessions: Session[];
  students: Student[];
  courses: Course[];
  onOpen: (s: Session) => void;
}) {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState("next");
  const [kind, setKind] = useState<UpcomingFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const names = useMemo(
    () => new Map(students.map((s) => [s.id, s.name.toLowerCase()])),
    [students],
  );
  const visible = useMemo(
    () =>
      filterUpcoming(sessions, courses, kind, students)
        .filter(
          (s) =>
            (names.get(s.studentId) || "").includes(search.toLowerCase()) &&
            (!course || s.courseId === course) &&
            (!status || s.status === status),
        )
        .sort((a, b) => compareSessions(a, b, order)),
    [sessions, courses, students, kind, names, search, course, status, order],
  );
  const activeFilters =
    Number(!!course) + Number(!!status) + Number(order !== "next");
  return (
    <div className="sessions-clean">
      <div className="sessions-toolbar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search sessions by student"
            placeholder="Search students or activities"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          aria-expanded={showFilters}
          aria-controls="session-filters"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={15} />
          Filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
      </div>
      {showFilters && (
        <div id="session-filters" className="session-filter-options">
          <label>
            Course
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Sort order
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="next">Next up</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <button
            className="text-button"
            onClick={() => {
              setCourse("");
              setStatus("");
              setOrder("next");
            }}
          >
            Reset
          </button>
        </div>
      )}
      <StatusButtons
        label="Session type"
        value={kind}
        options={[
          { value: "all", label: "All" },
          { value: "one", label: "1-on-1" },
          { value: "walk", label: "Walk-in" },
        ]}
        onChange={(value) => setKind(value as UpcomingFilter)}
      />
      <SessionAgenda
        sessions={visible}
        students={students}
        courses={courses}
        onOpen={onOpen}
      />
    </div>
  );
}
