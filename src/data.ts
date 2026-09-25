import Dexie, { type Table } from "dexie";
import { z } from "zod";
import { approvedCourses } from "./approvedCourses";
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
const id = z.string().min(1);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
  );
const stamp = z.string().datetime({ offset: true });
export const courseSchema = z.object({
  id,
  name: z.string().trim().min(1),
  code: z.string().optional(),
});
export const courseLabel = (course?: { name: string; code?: string }) =>
  course
    ? (course.code ? course.code + " — " : "") + course.name
    : "Choose course";
export const studentSchema = z.object({
  id,
  name: z.string().trim().min(1),
  courseId: id,
  note: z.string(),
  archived: z.boolean(),
  createdAt: stamp,
});
export const sessionSchema = z
  .object({
    id,
    studentId: z.string(),
    courseId: z.string(),
    title: z
      .string()
      .trim()
      .min(1)
      .refine((v) => /\btutoring\b/i.test(v), "Title must contain Tutoring"),
    scheduledStart: stamp,
    scheduledEnd: stamp,
    actualStart: z.union([stamp, z.literal("")]),
    actualEnd: z.union([stamp, z.literal("")]),
    topics: z.string(),
    notes: z.string(),
    status: z.enum(["scheduled", "completed", "cancelled"]),
    eventCancelled: z.boolean(),
    updatedAt: stamp,
    scheduleUpdatedAt: stamp,
    scheduledMinutes: z.number().int().nonnegative().optional(),
    actualMinutes: z.number().int().nonnegative().optional(),
    deleted: z.boolean().default(false),
  })
  .superRefine((s, c) => {
    if (Date.parse(s.scheduledEnd) <= Date.parse(s.scheduledStart))
      c.addIssue({
        code: "custom",
        message: "Scheduled end must be after start",
      });
    if (
      s.status === "completed" &&
      (!s.actualStart || !s.actualEnd || !s.studentId || !s.courseId)
    )
      c.addIssue({
        code: "custom",
        message: "Completed sessions need student, course and actual times",
      });
    if ((s.actualStart && !s.actualEnd) || (!s.actualStart && s.actualEnd))
      c.addIssue({ code: "custom", message: "Enter both actual times" });
    if (
      s.actualStart &&
      s.actualEnd &&
      Date.parse(s.actualEnd) <= Date.parse(s.actualStart)
    )
      c.addIssue({ code: "custom", message: "Actual end must be after start" });
  });
export const periodSchema = z.object({
  id,
  start: date,
  end: date,
  weeks: z.tuple([date, date]),
  submit: date,
  pay: date,
});
export const paymentSchema = z
  .object({
    id,
    periodId: id,
    status: z.enum(["upcoming", "submitted", "paid", "overdue"]),
    deposit: z.number().min(0).nullable(),
    depositDate: z.union([date, z.literal("")]),
    note: z.string(),
  })
  .refine(
    (p) => p.status !== "paid" || (p.deposit !== null && !!p.depositDate),
    "Paid requires actual deposit and date",
  );
export const settingsSchema = z.object({
  id: z.literal("settings"),
  wage: z.number().min(0).max(10000),
  deduction: z.number().min(0).max(100),
  deductionBasis: z.enum(["provisional", "manual"]).optional(),
  lastBackup: z.string(),
  lastSync: z.string(),
  connected: z.boolean(),
  calendarId: z.string(),
});
export const syncSchema = z.object({
  id,
  sessionId: id,
  eventId: id,
  calendarId: id,
  remoteUpdated: z.string(),
  localUpdated: z.string(),
  syncedAt: z.string(),
  etag: z.string().optional(),
});
export type Course = z.infer<typeof courseSchema>;
export type Student = z.infer<typeof studentSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Period = z.infer<typeof periodSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type SyncRecord = z.infer<typeof syncSchema>;
export class Database extends Dexie {
  students!: Table<Student>;
  courses!: Table<Course>;
  sessions!: Table<Session>;
  periods!: Table<Period>;
  payments!: Table<Payment>;
  settings!: Table<Settings>;
  sync!: Table<SyncRecord>;
  constructor(name = "TutorTrackPublic") {
    super(name);
    this.version(1).stores({
      students: "id,name,courseId",
      courses: "id,&name",
      sessions: "id,studentId,courseId,scheduledStart,actualStart,status",
      periods: "id,start",
      payments: "id,&periodId",
      settings: "id",
      sync: "id,&sessionId,&[calendarId+eventId]",
    });
  }
}
export const db = new Database();
db.sessions.hook("creating", (_key, s) => {
  s.scheduledMinutes = duration(s.scheduledStart, s.scheduledEnd);
  s.actualMinutes =
    s.actualStart && s.actualEnd ? duration(s.actualStart, s.actualEnd) : 0;
});
db.sessions.hook("updating", (changes, _key, s) => {
  const merged = { ...s, ...changes };
  return {
    scheduledMinutes: duration(merged.scheduledStart, merged.scheduledEnd),
    actualMinutes:
      merged.actualStart && merged.actualEnd
        ? duration(merged.actualStart, merged.actualEnd)
        : 0,
  };
});
export { seedPeriods } from "./payrollSchedule";
import { seedPeriods } from "./payrollSchedule";
export const defaults: Settings = {
  id: "settings",
  wage: 0,
  deduction: 0,
  deductionBasis: "manual",
  lastBackup: "",
  lastSync: "",
  connected: false,
  calendarId: "",
};
export async function initialize() {
  await db.transaction("rw", db.settings, db.periods, db.courses, async () => {
    const settings = await db.settings.get("settings");
    if (!settings) {
      await db.settings.put(defaults);
      await db.periods.bulkPut(seedPeriods);
    }
    for (const course of approvedCourses) {
      const existing = await db.courses
        .where("name")
        .equals(course.name)
        .first();
      if (!existing && !(await db.courses.get(course.id)))
        await db.courses.add(course);
      else if (existing && !existing.code)
        await db.courses.update(existing.id, { code: course.code });
    }
  });
}
export const localDate = (d: Date | string) => {
  const t = typeof d === "string" ? new Date(d) : d;
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
export function weekRange(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: localDate(start), end: localDate(end) };
}
export const duration = (start: string, end: string) =>
  start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 60000) : 0;
export const minutes = (s: Session) =>
  !s.deleted && s.status === "completed"
    ? duration(s.actualStart, s.actualEnd)
    : 0;
export const periodFor = (s: Session, ps: Period[]) =>
  s.status === "completed" && s.actualStart
    ? ps.find(
        (p) =>
          localDate(s.actualStart) >= p.start &&
          localDate(s.actualStart) <= p.end,
      )
    : undefined;
export function totals(ss: Session[], settings: Settings) {
  const mins = ss.reduce((n, s) => n + minutes(s), 0);
  const gross = Math.round(((mins * settings.wage) / 60) * 100) / 100;
  const deductions = Math.round(gross * settings.deduction) / 100;
  return {
    mins,
    gross,
    deductions,
    net: Math.round((gross - deductions) * 100) / 100,
  };
}
export const inRange = (s: Session, start: string, end: string) =>
  !!s.actualStart &&
  localDate(s.actualStart) >= start &&
  localDate(s.actualStart) <= end;
export const money = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    n,
  );
export const hours = (n: number) => (n / 60).toFixed(2);
export const fmtDate = (s: string) =>
  s
    ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString(
        "en-CA",
        { month: "short", day: "numeric" },
      )
    : "—";
export const fmtTime = (s: string) =>
  s
    ? new Date(s).toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
export async function courseId(name: string) {
  const clean = name.trim();
  if (!clean) throw Error("Course is required");
  const match = (await db.courses.toArray()).find(
    (c) => c.name.toLowerCase() === clean.toLowerCase(),
  );
  if (match) return match.id;
  const c = { id: uid(), name: clean };
  await db.courses.add(c);
  return c.id;
}
const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: stamp,
  students: z.array(studentSchema),
  courses: z.array(courseSchema),
  sessions: z.array(sessionSchema),
  periods: z.array(periodSchema),
  payments: z.array(paymentSchema),
  settings: settingsSchema,
  sync: z.array(syncSchema),
});
export function validateBackup(raw: unknown) {
  const b = backupSchema.parse(raw);
  for (const list of [
    b.students,
    b.courses,
    b.sessions,
    b.periods,
    b.payments,
    b.sync,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw Error("Duplicate record IDs");
  const has = (a: { id: string }[], s: string) => a.some((v) => v.id === s);
  for (const s of b.students)
    if (!has(b.courses, s.courseId)) throw Error("Missing student course");
  for (const s of b.sessions)
    if (
      (s.studentId && !has(b.students, s.studentId)) ||
      (s.courseId && !has(b.courses, s.courseId))
    )
      throw Error("Missing session reference");
  if (
    JSON.stringify(
      b.periods.slice().sort((a, c) => a.id.localeCompare(c.id)),
    ) !==
    JSON.stringify(seedPeriods.slice().sort((a, b) => a.id.localeCompare(b.id)))
  )
    throw Error("Payroll schedule does not match this build");
  for (const p of b.payments)
    if (!has(b.periods, p.periodId)) throw Error("Missing payroll reference");
  if (new Set(b.payments.map((p) => p.periodId)).size !== b.payments.length)
    throw Error("Duplicate payments");
  for (const r of b.sync)
    if (!has(b.sessions, r.sessionId)) throw Error("Missing sync session");
  if (
    new Set(b.sync.map((r) => r.sessionId)).size !== b.sync.length ||
    new Set(b.sync.map((r) => r.calendarId + "|" + r.eventId)).size !==
      b.sync.length
  )
    throw Error("Duplicate sync mapping");
  return b;
}
export async function exportData() {
  return db.transaction("r", db.tables, async () => ({
    version: 1,
    exportedAt: now(),
    students: await db.students.toArray(),
    courses: await db.courses.toArray(),
    sessions: await db.sessions.toArray(),
    periods: await db.periods.toArray(),
    payments: await db.payments.toArray(),
    settings: await db.settings.get("settings"),
    sync: await db.sync.toArray(),
  }));
}
export async function importData(raw: unknown) {
  const b = validateBackup(raw);
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.students.bulkPut(b.students);
    await db.courses.bulkPut(b.courses);
    await db.sessions.bulkPut(b.sessions);
    await db.periods.bulkPut(b.periods);
    await db.payments.bulkPut(b.payments);
    await db.sync.bulkPut(b.sync);
    await db.settings.put({ ...b.settings, connected: false });
  });
  await initialize();
}
export async function deleteSession(s: Session) {
  if (await db.sync.where("sessionId").equals(s.id).first())
    await db.sessions.update(s.id, {
      deleted: true,
      eventCancelled: true,
      scheduleUpdatedAt: now(),
      updatedAt: now(),
    });
  else await db.sessions.delete(s.id);
}

export function nextPaycheck(
  sessions: Session[],
  periods: Period[],
  payments: Payment[],
  settings: Settings,
  today = localDate(new Date()),
) {
  const period = periods
    .filter(
      (p) =>
        p.pay >= today &&
        !payments.some(
          (payment) => payment.periodId === p.id && payment.status === "paid",
        ),
    )
    .sort((a, b) => a.pay.localeCompare(b.pay))[0];
  return period
    ? {
        period,
        ...totals(
          sessions.filter((s) => periodFor(s, periods)?.id === period.id),
          settings,
        ),
      }
    : undefined;
}

export function sessionWithHours(
  session: Session,
  adjustHours: boolean,
): Session {
  return session.status === "completed" && !adjustHours
    ? {
        ...session,
        actualStart: session.scheduledStart,
        actualEnd: session.scheduledEnd,
      }
    : session;
}

export async function saveSessionEntry(
  session: Session,
  adjustHours: boolean,
  newStudent?: { name: string; course?: string; courseId?: string },
  original?: Session,
) {
  return db.transaction(
    "rw",
    db.students,
    db.courses,
    db.sessions,
    async () => {
      let value = sessionWithHours(session, adjustHours);
      if (newStudent) {
        const student = studentSchema.parse({
          id: uid(),
          name: newStudent.name,
          courseId:
            newStudent.courseId || (await courseId(newStudent.course || "")),
          note: "",
          archived: false,
          createdAt: now(),
        });
        await db.students.add(student);
        value = { ...value, studentId: student.id, courseId: student.courseId };
      }
      if (
        !(await db.students.get(value.studentId)) ||
        !(await db.courses.get(value.courseId))
      )
        throw Error("Choose a student and course.");
      const checked = sessionSchema.parse({
        ...value,
        eventCancelled: value.status === "cancelled",
        updatedAt: now(),
      });
      const changed =
        !original ||
        (
          ["scheduledStart", "scheduledEnd", "title", "eventCancelled"] as const
        ).some((k) => checked[k] !== original[k]);
      checked.scheduleUpdatedAt = changed ? now() : original!.scheduleUpdatedAt;
      await db.sessions.put(checked);
      return checked;
    },
  );
}
