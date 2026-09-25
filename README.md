# TutorTrack

An offline desktop app for keeping track of tutoring sessions, students, hours and pay periods.

This is a sanitized snapshot of an earlier desktop version. It starts empty, with no courses, payroll dates, student records or personal earnings settings.

## Run locally

Requires Node.js 22 or later. Windows is the primary platform.

```sh
npm ci
npm test
npm run desktop
```

Set an hourly rate and deduction percentage in Settings. The defaults are zero. Configure your own payroll calendar in `src/payrollSchedule.ts` and courses in `src/approvedCourses.ts` before the first launch.

Records are saved in IndexedDB within Electron's `TutorTrackPublic` user-data folder, separately from the source. Export JSON in Settings makes a backup. Import replaces existing records.

## Stack

React, TypeScript, Electron, Vite, Tailwind CSS, Dexie, Zod and Vitest.
