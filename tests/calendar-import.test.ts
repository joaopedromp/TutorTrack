import "fake-indexeddb/auto";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  defaults,
  now,
  initialize,
  exportData,
  importData,
} from "../src/data";
import {
  importCalendarEvents,
  parseTutoring,
  type GoogleEvent,
} from "../src/calendarImport";
const calendar = "example-calendar";
const event = (changes: Partial<GoogleEvent> = {}): GoogleEvent => ({
  id: "event-1",
  summary: "Tutoring Work",
  description:
    "Student: Example Learner\nCourse: CS 101\nTopics: Assignment help\nNotes: Practice functions",
  location: "Online",
  start: { dateTime: "2027-01-12T10:00:00-05:00" },
  end: { dateTime: "2027-01-12T11:00:00-05:00" },
  status: "confirmed",
  updated: "2027-01-01T12:00:00Z",
  ...changes,
});
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await db.settings.put(defaults);
  await db.courses.add({
    id: "course",
    code: "CS 101",
    name: "Example course",
  });
});
it("parses labeled fields, HTML line breaks, location and timezone", () => {
  expect(parseTutoring(event())).toMatchObject({
    name: "Example Learner",
    code: "CS101",
    location: "Online",
    start: "2027-01-12T15:00:00.000Z",
    end: "2027-01-12T16:00:00.000Z",
    topics: "Assignment help",
    notes: "Practice functions",
  });
  expect(
    parseTutoring(
      event({
        description:
          "<div>Student: Example Learner</div><div>Course: CS 101</div><div>Notes: A &amp; B</div>",
      }),
    ).notes,
  ).toBe("A & B");
});
it("supports existing prose descriptions without using the organizer as student", () => {
  expect(
    parseTutoring(
      event({
        description:
          "Tutoring session with Example Learner (CS 101). Needs help with loops.",
      }),
    ),
  ).toMatchObject({
    name: "Example Learner",
    code: "CS101",
    notes: "Needs help with loops.",
  });
});
it("creates one scheduled session and reusable student with no actual hours", async () => {
  const report = await importCalendarEvents(calendar, [event()]);
  expect(report.added).toBe(1);
  const session = (await db.sessions.toArray())[0];
  expect(session).toMatchObject({
    status: "scheduled",
    actualStart: "",
    actualEnd: "",
    actualMinutes: 0,
    location: "Online",
  });
  expect(await db.students.count()).toBe(1);
  expect((await importCalendarEvents(calendar, [event()])).unchanged).toBe(1);
  expect(await db.sessions.count()).toBe(1);
});
it("reuses a student across courses and does not change their profile", async () => {
  await db.students.add({
    id: "existing",
    name: " example   learner ",
    courseId: "old-course",
    archived: false,
    note: "Keep this",
    createdAt: now(),
  });
  await importCalendarEvents(calendar, [event()]);
  expect(await db.students.count()).toBe(1);
  expect((await db.sessions.toArray())[0].studentId).toBe("existing");
  expect((await db.students.get("existing"))?.note).toBe("Keep this");
});
it("updates imported times and notes without creating duplicate recurring instances", async () => {
  await importCalendarEvents(calendar, [event(), event({ id: "instance-2" })]);
  // Identical duplicate booking is flagged rather than inserted twice.
  expect(await db.sessions.count()).toBe(1);
  const moved = event({
    start: { dateTime: "2027-01-13T10:00:00-05:00" },
    end: { dateTime: "2027-01-13T11:00:00-05:00" },
    description: "Student: Example Learner\nCourse: CS 101\nNotes: Updated",
  });
  expect((await importCalendarEvents(calendar, [moved])).updated).toBe(1);
  expect((await db.sessions.toArray())[0].notes).toBe("Updated");
  await importCalendarEvents(calendar, [
    event({
      id: "instance-3",
      start: { dateTime: "2027-01-20T10:00:00-05:00" },
      end: { dateTime: "2027-01-20T11:00:00-05:00" },
    }),
  ]);
  expect(await db.sessions.count()).toBe(2);
});
it("preserves completed sessions and payroll inputs on edits and cancellations", async () => {
  await importCalendarEvents(calendar, [event()]);
  const session = (await db.sessions.toArray())[0];
  await db.sessions.update(session.id, {
    status: "completed",
    actualStart: session.scheduledStart,
    actualEnd: session.scheduledEnd,
  });
  const before = await db.sessions.get(session.id);
  await importCalendarEvents(calendar, [event({ status: "cancelled" })]);
  expect(await db.sessions.get(session.id)).toEqual(before);
});
it("preserves local edits and reports a conflict", async () => {
  await importCalendarEvents(calendar, [event()]);
  const session = (await db.sessions.toArray())[0];
  await db.sessions.update(session.id, { notes: "My local notes" });
  const report = await importCalendarEvents(calendar, [event()]);
  expect(report.issues).toHaveLength(1);
  expect((await db.sessions.get(session.id))?.notes).toBe("My local notes");
});
it("cancels only linked unedited scheduled events and never missing events", async () => {
  await importCalendarEvents(calendar, [event()]);
  await importCalendarEvents(calendar, []);
  expect((await db.sessions.toArray())[0].status).toBe("scheduled");
  expect(
    (
      await importCalendarEvents(calendar, [
        { id: "event-1", status: "cancelled" },
      ])
    ).cancelled,
  ).toBe(1);
  expect((await db.sessions.toArray())[0].status).toBe("cancelled");
});
it("does not recreate a session deleted locally", async () => {
  await importCalendarEvents(calendar, [event()]);
  const session = (await db.sessions.toArray())[0];
  await db.sessions.update(session.id, { deleted: true });
  await importCalendarEvents(calendar, [event()]);
  expect(await db.sessions.count()).toBe(1);
  expect((await db.sessions.get(session.id))?.deleted).toBe(true);
});
it("does not add students when course resolution fails", async () => {
  const report = await importCalendarEvents(calendar, [
    event({ description: "Student: Example Learner\nCourse: XX 999" }),
  ]);
  expect(report.issues).toHaveLength(1);
  expect(await db.students.count()).toBe(0);
  expect(await db.sessions.count()).toBe(0);
});
it("flags duplicate and archived student matches", async () => {
  for (const id of ["one", "two"])
    await db.students.add({
      id,
      name: "Example Learner",
      courseId: "course",
      note: "",
      archived: false,
      createdAt: now(),
    });
  expect((await importCalendarEvents(calendar, [event()])).issues).toHaveLength(
    1,
  );
  expect(await db.sessions.count()).toBe(0);
  await db.students.delete("two");
  await db.students.update("one", { archived: true });
  expect((await importCalendarEvents(calendar, [event()])).issues).toHaveLength(
    1,
  );
});
it("links an existing manual session but never overwrites it", async () => {
  await importCalendarEvents(calendar, [event()]);
  await db.sync.clear();
  const session = (await db.sessions.toArray())[0];
  await db.sessions.update(session.id, { notes: "Original manual record" });
  expect((await importCalendarEvents(calendar, [event()])).linked).toBe(1);
  expect(await db.sessions.count()).toBe(1);
  expect((await importCalendarEvents(calendar, [event()])).issues).toHaveLength(
    1,
  );
  expect((await db.sessions.get(session.id))?.notes).toBe(
    "Original manual record",
  );
});
it("rejects all-day events, missing offsets, duplicate labels and invalid times", () => {
  for (const invalid of [
    event({ start: { date: "2027-01-12" } }),
    event({ start: { dateTime: "2027-01-12T10:00:00" } }),
    event({ end: { dateTime: "2027-01-12T09:00:00-05:00" } }),
    event({ description: "Student: A\nStudent: B\nCourse: CS 101" }),
  ])
    expect(() => parseTutoring(invalid)).toThrow();
});
it("ignores unrelated titles and does not reset an existing database", async () => {
  await db.settings.update("settings", { wage: 30, deduction: 7 });
  await importCalendarEvents(calendar, [event({ summary: "Other meeting" })]);
  expect(await db.sessions.count()).toBe(0);
  expect((await db.settings.get("settings"))?.wage).toBe(30);
});
it("serializes simultaneous imports without duplicate students or sessions", async () => {
  await Promise.all([
    importCalendarEvents(calendar, [event()]),
    importCalendarEvents(calendar, [event()]),
  ]);
  expect(await db.sessions.count()).toBe(1);
  expect(await db.students.count()).toBe(1);
});
it("preserves imported location and link protection through a backup round trip", async () => {
  await db.settings.clear();
  await initialize();
  await importCalendarEvents(calendar, [event()]);
  const before = await exportData();
  await importData(before);
  const after = await exportData();
  expect(after.sessions).toEqual(before.sessions);
  expect(after.students).toEqual(before.students);
  expect(after.sync).toEqual(before.sync);
});
it("rolls back the entire import on an unexpected failure without touching existing records", async () => {
  const before = await exportData();
  await expect(
    importCalendarEvents(calendar, [event(), { id: "" }]),
  ).rejects.toThrow();
  const after = await exportData();
  for (const key of [
    "students",
    "courses",
    "sessions",
    "periods",
    "payments",
    "sync",
  ] as const)
    expect(after[key]).toEqual(before[key]);
});
