import "fake-indexeddb/auto";
import { setPaymentStatus, removeCourse, shiftSessionStart } from "../src/data";
import { beforeEach, expect, it } from "vitest";
import {
  db,
  initialize,
  defaults,
  type Period,
  totals,
  periodFor,
  sessionSchema,
  exportData,
  importData,
  nextPaycheck,
  saveSessionEntry,
  now,
  type Session,
} from "../src/data";

const settings = { ...defaults, wage: 25, deduction: 10 };
const seedPeriods: Period[] = [
  {
    id: "test-period",
    start: "2026-01-04",
    end: "2026-01-17",
    weeks: ["2026-01-10", "2026-01-17"],
    submit: "2026-01-19",
    pay: "2026-01-23",
  },
];
const sample = (changes: Partial<Session> = {}): Session => ({
  id: "session",
  studentId: "student",
  courseId: "sample-math",
  title: "Tutoring",
  scheduledStart: "2026-01-06T15:00:00Z",
  scheduledEnd: "2026-01-06T17:00:00Z",
  actualStart: "2026-01-06T15:00:00Z",
  actualEnd: "2026-01-06T16:30:00Z",
  status: "completed",
  topics: "Practice",
  notes: "Example",
  eventCancelled: false,
  updatedAt: now(),
  scheduleUpdatedAt: now(),
  deleted: false,
  ...changes,
});

beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await initialize();
});

it("starts completely empty with zero earnings settings", async () => {
  expect(await db.students.count()).toBe(0);
  expect(await db.sessions.count()).toBe(0);
  expect(await db.payments.count()).toBe(0);
  expect(await db.courses.count()).toBe(0);
  expect(await db.periods.count()).toBe(0);
  expect(defaults.wage).toBe(0);
  expect(defaults.deduction).toBe(0);
});

it("counts only completed work and rounds deductions to cents", () => {
  expect(
    totals(
      [
        sample(),
        sample({ status: "scheduled" }),
        sample({ status: "cancelled" }),
        sample({ deleted: true }),
      ],
      settings,
    ),
  ).toEqual({ mins: 90, gross: 37.5, deductions: 3.75, net: 33.75 });
});

it("assigns both boundaries to their covered period", () => {
  for (const period of seedPeriods)
    for (const date of [period.start, period.end]) {
      expect(
        periodFor(sample({ actualStart: date + "T12:00:00Z" }), seedPeriods)
          ?.id,
      ).toBe(period.id);
    }
});

it("rejects backwards session times", () => {
  expect(() =>
    sessionSchema.parse(sample({ actualEnd: "2026-01-06T14:00:00Z" })),
  ).toThrow();
});

it("creates a student and session atomically", async () => {
  await db.courses.add({ id: "sample-math", name: "Example course" });
  const saved = await saveSessionEntry(sample({ studentId: "" }), false, {
    name: "Example Learner",
    courseId: "sample-math",
  });
  expect(await db.students.count()).toBe(1);
  expect(saved.actualEnd).toBe(saved.scheduledEnd);
  await expect(
    saveSessionEntry(sample({ scheduledEnd: sample().scheduledStart }), false, {
      name: "Invalid Learner",
      course: "New course",
    }),
  ).rejects.toThrow();
  expect(await db.students.count()).toBe(1);
  expect(await db.courses.count()).toBe(1);
});

it("preserves manual earnings settings on subsequent launches", async () => {
  await db.settings.put(settings);
  await initialize();
  expect(await db.settings.get("settings")).toEqual(settings);
});

it("round-trips records and refuses a broken backup without clearing data", async () => {
  await db.courses.add({ id: "sample-math", name: "Example course" });
  await saveSessionEntry(sample({ studentId: "" }), false, {
    name: "Example Learner",
    courseId: "sample-math",
  });
  const backup = await exportData();
  await importData(backup);
  expect(await db.sessions.count()).toBe(1);
  await expect(importData({ ...backup, courses: [] })).rejects.toThrow();
  expect(await db.sessions.count()).toBe(1);
});

it("shows only the work covered by the next unpaid paycheck", () => {
  const result = nextPaycheck(
    [sample(), sample({ status: "scheduled" })],
    seedPeriods,
    [],
    settings,
    "2026-01-20",
  );
  expect(result?.period.id).toBe(seedPeriods[0].id);
  expect(result?.gross).toBe(37.5);
  expect(result?.net).toBe(33.75);
});

it("preserves duration when moving the start time across midnight", () => {
  expect(
    shiftSessionStart(
      "2026-01-06T14:00:00Z",
      "2026-01-06T15:00:00Z",
      "2026-01-07T23:30:00Z",
    ).end,
  ).toBe("2026-01-08T00:30:00.000Z");
});

it("archives courses without deleting session history", async () => {
  await db.courses.add({ id: "sample-math", name: "Example course" });
  const session = await saveSessionEntry(sample({ studentId: "" }), false, {
    name: "Example Learner",
    courseId: "sample-math",
  });
  await removeCourse("sample-math");
  await initialize();
  await importData(await exportData());
  expect((await db.courses.get("sample-math"))?.archived).toBe(true);
  expect((await db.sessions.get(session.id))?.courseId).toBe("sample-math");
});

it("marks a period paid without inventing a deposit", async () => {
  await db.periods.add(seedPeriods[0]);
  const payment = await setPaymentStatus(seedPeriods[0].id, "paid");
  expect(payment.deposit).toBeNull();
  expect(
    nextPaycheck([], seedPeriods, [payment], settings, "2026-01-20"),
  ).toBeUndefined();
  await setPaymentStatus(seedPeriods[0].id, "upcoming");
  expect(await db.payments.count()).toBe(1);
});

it("keeps hourly-rate precision until the gross total is rounded", () => {
  expect(totals([sample()], { ...settings, wage: 25.4321 })).toEqual({
    mins: 90,
    gross: 38.15,
    deductions: 3.82,
    net: 34.33,
  });
});
