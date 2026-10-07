import { ChevronLeft, Pencil } from "lucide-react";
import {
  hours,
  minutes,
  type Course,
  type Session,
  type Student,
} from "./data";
import { SessionAgenda } from "./SessionsPage";

export function StudentProfile({
  student,
  sessions,
  students,
  courses,
  onBack,
  onEdit,
  onOpen,
}: {
  student: Student;
  sessions: Session[];
  students: Student[];
  courses: Course[];
  onBack: () => void;
  onEdit: () => void;
  onOpen: (session: Session) => void;
}) {
  const completed = sessions.filter((s) => s.status === "completed");
  const upcoming = sessions
    .filter(
      (s) =>
        s.status === "scheduled" &&
        !s.eventCancelled &&
        s.scheduledEnd > new Date().toISOString(),
    )
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  const upcomingIds = new Set(upcoming.map((s) => s.id));
  const history = sessions
    .filter((s) => !upcomingIds.has(s.id))
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart));
  return (
    <div className="student-profile-clean">
      <button className="text-button back" onClick={onBack}>
        <ChevronLeft size={16} />
        All students
      </button>
      <div className="profile-title">
        <h2>{student.name}</h2>
        <button
          className="icon"
          title="Edit student or activity"
          aria-label="Edit student or activity"
          onClick={onEdit}
        >
          <Pencil size={16} />
        </button>
        {student.archived && <span className="muted">Archived</span>}
      </div>
      <div className="profile-totals">
        <span>
          <strong>
            {Number(hours(completed.reduce((n, s) => n + minutes(s), 0)))} h
          </strong>{" "}
          completed
        </span>
        <span>
          <strong>{completed.length}</strong> completed sessions
        </span>
      </div>
      {student.note && <p className="hint">{student.note}</p>}
      <h2 className="profile-section-heading">Upcoming</h2>
      <SessionAgenda
        sessions={upcoming}
        students={students}
        courses={courses}
        onOpen={onOpen}
        empty="No upcoming sessions"
      />
      <h2 className="profile-section-heading">History</h2>
      <SessionAgenda
        sessions={history}
        students={students}
        courses={courses}
        onOpen={onOpen}
        empty="No past sessions"
      />
    </div>
  );
}
