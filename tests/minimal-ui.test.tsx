import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { useLiveQuery } from "dexie-react-hooks";
import App from "../src/App";
import { defaults, type Period } from "../src/data";

const view = vi.hoisted(() => ({ page: "Dashboard" }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (value: unknown) =>
      actual.useState(value === "Dashboard" ? view.page : value),
  };
});
const period: Period = {
  id: "test",
  start: "2026-01-04",
  end: "2026-01-17",
  weeks: ["2026-01-10", "2026-01-17"],
  submit: "2026-01-19",
  pay: "2026-01-23",
};
const completed = {
  id: "completed",
  studentId: "student",
  courseId: "course",
  title: "Tutoring",
  scheduledStart: "2026-01-05T14:00:00Z",
  scheduledEnd: "2026-01-05T15:00:00Z",
  actualStart: "2026-01-05T14:00:00Z",
  actualEnd: "2026-01-05T15:00:00Z",
  status: "completed",
  topics: "",
  notes: "",
  eventCancelled: false,
  deleted: false,
};
const fixture = {
  students: [
    {
      id: "student",
      name: "Example Learner",
      courseId: "course",
      archived: false,
      note: "",
      createdAt: "2026-01-01T12:00:00Z",
    },
  ],
  courses: [{ id: "course", name: "Example course", code: "EX 101" }],
  sessions: [completed],
  periods: [period],
  payments: [],
  settings: { ...defaults, wage: 25, deduction: 10 },
  sync: [],
};
function screen(page: string) {
  view.page = page;
  vi.mocked(useLiveQuery)
    .mockReturnValue(fixture.courses)
    .mockReturnValueOnce(fixture);
  return renderToStaticMarkup(<App />);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-06T12:00:00Z"));
  fixture.sessions = [completed];
});
afterEach(() => vi.useRealTimers());

it("keeps session search and sorting without per-session earnings", () => {
  const html = screen("Sessions");
  expect(html).toContain("Example Learner");
  expect(html).toContain("Newest first");
  expect(html).toContain("Oldest first");
  expect(html).not.toContain('type="date"');
  expect(html).not.toContain("$25.00");
});
it("offers only upcoming and paid statuses", () => {
  const html = screen("Payroll");
  expect(html).toContain('value="paid"');
  expect(html).toContain('value="upcoming"');
  expect(html).not.toContain('value="submitted"');
  expect(html).not.toContain('value="overdue"');
  expect(html).not.toContain("Actual deposit");
});
it("retains backup controls and course search", () => {
  const html = screen("Settings");
  for (const label of [
    "Search courses to remove",
    "Deductions (%)",
    "Export JSON",
    "Import JSON",
    "Import replaces current records.",
  ])
    expect(html).toContain(label);
});
it("totals upcoming hours across pay-period boundaries without counting them as worked", () => {
  fixture.sessions.push(
    ...["2026-01-08", "2026-01-20"].map((day, i) => ({
      ...completed,
      id: "future-" + i,
      status: "scheduled",
      scheduledStart: day + "T14:00:00Z",
      scheduledEnd: day + "T15:00:00Z",
      actualStart: "",
      actualEnd: "",
    })),
  );
  const html = screen("Dashboard");
  expect((html.match(/class="agenda-session"/g) || []).length).toBe(2);

  const metrics = html
    .split('aria-label="Current pay period">')[1]
    .split('</section>')[0];
  expect(metrics).toContain("1.00");
  expect(metrics).toContain("$25.00");
});
it("includes both weeks of the current pay period", () => {
  vi.setSystemTime(new Date("2026-01-14T12:00:00Z"));
  fixture.sessions.push({
    ...completed,
    id: "second-week",
    actualStart: "2026-01-13T14:00:00Z",
    actualEnd: "2026-01-13T16:00:00Z",
  });
  const html = screen("Dashboard");
  expect(html).toContain("Current pay period");
  expect(html).toContain("Jan 4 – Jan 17");
  const metrics = html
    .split('aria-label="Current pay period">')[1]
    .split('</section>')[0];
  expect(metrics).toContain("3.00");
  expect(metrics).not.toContain("Gross earnings");
  expect(metrics).toContain("$67.50");
});
it("renders an empty dashboard without invented records", () => {
  view.page = "Dashboard";
  vi.mocked(useLiveQuery)
    .mockReturnValue([])
    .mockReturnValueOnce({
      ...fixture,
      students: [],
      courses: [],
      sessions: [],
      periods: [],
      settings: defaults,
    });
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain("No upcoming student sessions");
  expect(html).toContain("No upcoming payday");
  expect(html).not.toContain("Example Learner");
});

