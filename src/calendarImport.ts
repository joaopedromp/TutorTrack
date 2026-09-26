import {
  db,
  now,
  uid,
  sessionSchema,
  type Session,
  type Course,
  type Student,
} from "./data";

export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}
export interface ImportReport {
  added: number;
  updated: number;
  linked: number;
  unchanged: number;
  cancelled: number;
  issues: { eventId: string; message: string }[];
}
const nameKey = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const codeKey = (value: string) =>
  value
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[\s–—-]+/g, "");
export const isTutoring = (event: GoogleEvent) =>
  nameKey(event.summary || "") === "tutoring work";

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n?/g, "\n")
    .trim();
}
export function parseTutoring(event: GoogleEvent) {
  const text = plainText(event.description || "");
  const studentLines = [...text.matchAll(/^Student:\s*(.+)$/gim)];
  const courseLines = [...text.matchAll(/^Course:\s*(.+)$/gim)];
  let name = "",
    code = "",
    topics = "",
    notes = "";
  if (studentLines.length || courseLines.length) {
    if (studentLines.length !== 1 || courseLines.length !== 1)
      throw Error("Use exactly one Student: line and one Course: line.");
    name = studentLines[0][1].trim();
    code = courseLines[0][1].trim();
    topics = text.match(/^Topics:\s*(.*)$/im)?.[1]?.trim() || "";
    notes = text.match(/^Notes:[ \t]*(.*(?:\n[\s\S]*)?)$/im)?.[1]?.trim() || "";
  } else {
    const legacy = text.match(
      /^Tutoring session with\s+(.+?)\s*\(([A-Za-z]+\s*\d+[A-Za-z]*)\)\s*[.\-–]?\s*([\s\S]*)$/i,
    );
    if (!legacy)
      throw Error(
        "Description needs Student: and Course: lines, or “Tutoring session with Name (CODE).”",
      );
    [, name, code, notes] = legacy;
  }
  if (
    !name ||
    name.length > 200 ||
    !/^\p{L}[\p{L}\p{M}\p{N} .,'’()\-]*$/u.test(name)
  )
    throw Error("Student name needs review.");
  if (!/^[A-Za-z]+[ \t-]*\d+[A-Za-z]*$/.test(code))
    throw Error("Use a course code, for example CS 101.");
  const start = event.start?.dateTime,
    end = event.end?.dateTime;
  if (
    !start ||
    !end ||
    !/(Z|[+-]\d\d:\d\d)$/.test(start) ||
    !/(Z|[+-]\d\d:\d\d)$/.test(end) ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    Date.parse(end) <= Date.parse(start)
  )
    throw Error("A timed event with valid start and end times is required.");
  if (topics.toLowerCase() === "not provided") topics = "";
  if (notes.toLowerCase() === "not provided") notes = "";
  return {
    name: name.trim(),
    code: codeKey(code),
    topics,
    notes,
    location: plainText(event.location || ""),
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  };
}
function matchCourse(courses: Course[], code: string) {
  const matches = courses.filter(
    (course) => codeKey(course.code || "") === code,
  );
  if (matches.length !== 1 || matches[0].archived)
    throw Error(
      matches.length > 1
        ? "Multiple courses have this code. Review courses in Settings."
        : "Course code is missing or archived in TutorTrack.",
    );
  return matches[0];
}
function matchStudent(students: Student[], name: string) {
  const matches = students.filter(
    (student) => nameKey(student.name) === nameKey(name),
  );
  if (matches.length > 1)
    throw Error(
      "More than one student has this name. Review the student records.",
    );
  if (matches[0]?.archived)
    throw Error("This student is archived. Restore them before importing.");
  return matches[0];
}
export function sessionFingerprint(session: Session) {
  return JSON.stringify([
    session.studentId,
    session.courseId,
    session.title,
    session.scheduledStart,
    session.scheduledEnd,
    session.actualStart,
    session.actualEnd,
    session.status,
    session.topics,
    session.notes,
    session.location || "",
    session.eventCancelled,
    session.deleted,
  ]);
}

// One transaction prevents half-imported students/sessions and serializes repeated clicks.
// Missing events are never treated as deletions: a date window is not a complete calendar.
export async function importCalendarEvents(
  calendarId: string,
  events: GoogleEvent[],
): Promise<ImportReport> {
  if (!calendarId || calendarId.length > 1024 || events.length > 5000)
    throw Error("Invalid calendar response.");
  const report: ImportReport = {
    added: 0,
    updated: 0,
    linked: 0,
    unchanged: 0,
    cancelled: 0,
    issues: [],
  };
  await db.transaction(
    "rw",
    [db.students, db.courses, db.sessions, db.sync, db.settings],
    async () => {
      const courses = await db.courses.toArray();
      for (const event of events) {
        if (!event.id || event.id.length > 1024)
          throw Error("Invalid event identifier.");
        const link = await db.sync
          .where("[calendarId+eventId]")
          .equals([calendarId, event.id])
          .first();
        const existing = link
          ? await db.sessions.get(link.sessionId)
          : undefined;
        if (!link && !isTutoring(event)) continue;
        if (link && (!existing || existing.deleted)) {
          report.unchanged++;
          continue;
        }
        if (existing && existing.status === "completed") {
          report.unchanged++;
          continue;
        }
        if (
          existing &&
          (!link?.importFingerprint ||
            link.importFingerprint !== sessionFingerprint(existing))
        ) {
          report.issues.push({
            eventId: event.id,
            message:
              "Locally edited session kept unchanged. Review it before importing further calendar changes.",
          });
          continue;
        }
        if (event.status === "cancelled") {
          if (existing && link) {
            const value = {
              ...existing,
              status: "cancelled" as const,
              eventCancelled: true,
              updatedAt: now(),
              scheduleUpdatedAt: now(),
            };
            await db.sessions.put(value);
            await db.sync.update(link.id, {
              importFingerprint: sessionFingerprint(value),
              remoteUpdated: event.updated || "",
              syncedAt: now(),
            });
            report.cancelled++;
          }
          continue;
        }
        if (!isTutoring(event)) {
          report.issues.push({
            eventId: event.id,
            message: "Linked event was renamed. Local session kept unchanged.",
          });
          continue;
        }
        // Validate and resolve before making any writes for this event.
        let parsed: ReturnType<typeof parseTutoring>,
          course: Course,
          student: Student | undefined;
        try {
          parsed = parseTutoring(event);
          course = matchCourse(courses, parsed.code);
          student = matchStudent(await db.students.toArray(), parsed.name);
        } catch (error) {
          report.issues.push({
            eventId: event.id,
            message:
              error instanceof Error ? error.message : "Event needs review.",
          });
          continue;
        }
        if (existing && student?.id !== existing.studentId) {
          report.issues.push({
            eventId: event.id,
            message:
              "Student identity changed in Google Calendar. Local session kept unchanged.",
          });
          continue;
        }
        if (!link && student) {
          const duplicates = (
            await db.sessions.where("studentId").equals(student.id).toArray()
          ).filter(
            (s) =>
              !s.deleted &&
              Date.parse(s.scheduledStart) === Date.parse(parsed.start) &&
              Date.parse(s.scheduledEnd) === Date.parse(parsed.end),
          );
          if (duplicates.length) {
            const duplicate = duplicates[0];
            if (
              duplicates.length !== 1 ||
              duplicate.courseId !== course.id ||
              (await db.sync.where("sessionId").equals(duplicate.id).first())
            ) {
              report.issues.push({
                eventId: event.id,
                message:
                  "A matching local session already exists. No duplicate was added.",
              });
              continue;
            }
            await db.sync.add({
              id: uid(),
              sessionId: duplicate.id,
              eventId: event.id,
              calendarId,
              remoteUpdated: event.updated || "",
              localUpdated: duplicate.updatedAt,
              syncedAt: now(),
            });
            report.linked++;
            continue; // Do not claim ownership of previously entered records.
          }
        }
        const newStudent = !student;
        student = student || {
          id: uid(),
          name: parsed.name,
          courseId: course.id,
          note: "",
          archived: false,
          createdAt: now(),
        };
        const value = sessionSchema.parse({
          ...existing,
          id: existing?.id || uid(),
          studentId: student.id,
          courseId: course.id,
          title: "Tutoring Work",
          scheduledStart: parsed.start,
          scheduledEnd: parsed.end,
          actualStart: "",
          actualEnd: "",
          status: "scheduled",
          topics: parsed.topics,
          notes: parsed.notes,
          location: parsed.location,
          eventCancelled: false,
          deleted: false,
          updatedAt: now(),
          scheduleUpdatedAt: now(),
        });
        if (
          existing &&
          sessionFingerprint(existing) === sessionFingerprint(value)
        ) {
          report.unchanged++;
          continue;
        }
        if (newStudent) await db.students.add(student);
        await db.sessions.put(value);
        await db.sync.put({
          id: link?.id || uid(),
          sessionId: value.id,
          eventId: event.id,
          calendarId,
          remoteUpdated: event.updated || "",
          localUpdated: value.updatedAt,
          syncedAt: now(),
          importFingerprint: sessionFingerprint(value),
        });
        if (existing) report.updated++;
        else report.added++;
      }
      await db.settings.update("settings", { lastSync: now() });
    },
  );
  return report;
}
