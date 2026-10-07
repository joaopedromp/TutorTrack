import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, defaults, minutes, periodFor, type Session } from "./data";

// Independent subscriptions avoid reloading session history on a settings/payment edit.
export function useAppData() {
  const students = useLiveQuery(() => db.students.toArray());
  const courses = useLiveQuery(() => db.courses.toArray());
  const sessions = useLiveQuery(async () =>
    (await db.sessions.toArray()).filter((s) => !s.deleted),
  );
  const periods = useLiveQuery(() => db.periods.toArray());
  const payments = useLiveQuery(() => db.payments.toArray());
  const settings = useLiveQuery(
    async () => (await db.settings.get("settings")) || defaults,
  );
  const indexes = useMemo(() => {
    const byStudent = new Map<string, Session[]>();
    const byPeriod = new Map<string, Session[]>();
    const completedMinutes = new Map<string, number>();
    for (const session of sessions || []) {
      const group = byStudent.get(session.studentId) || [];
      group.push(session);
      byStudent.set(session.studentId, group);
      completedMinutes.set(
        session.studentId,
        (completedMinutes.get(session.studentId) || 0) + minutes(session),
      );
      const period = periodFor(session, periods || []);
      if (period) {
        const included = byPeriod.get(period.id) || [];
        included.push(session);
        byPeriod.set(period.id, included);
      }
    }
    return { byStudent, byPeriod, completedMinutes };
  }, [sessions, periods]);
  const studentById = useMemo(
    () => new Map(students?.map((s) => [s.id, s])),
    [students],
  );
  const courseById = useMemo(
    () => new Map(courses?.map((c) => [c.id, c])),
    [courses],
  );
  return students && courses && sessions && periods && payments && settings
    ? {
        students,
        courses,
        sessions,
        periods,
        payments,
        settings,
        ...indexes,
        studentById,
        courseById,
      }
    : undefined;
}
