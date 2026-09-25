# TutorTrack

An offline desktop app for organizing tutoring sessions, students, hours and pay periods. Schedule a session, mark it complete, and see the hours reflected in the right paycheck.

![TutorTrack dashboard with an empty database](docs/dashboard.png)

## Features

- Month and week calendars, adjustable session duration, and searchable courses.
- Create a student while adding a session; reuse their profile later.
- Upcoming-session totals and completed hours for the current pay period.
- Gross and take-home estimates using an editable hourly rate and deduction percentage.
- Mark pay periods as paid, archive students or courses, and export or restore JSON backups.

## Run locally

Requires Node.js 22.12 or later. Windows is the tested platform.

```sh
npm ci
npm test
npm run desktop
```

The first launch downloads Electron. After installation, the app works offline. `npm run desktop` builds and opens the app; `npm start` opens the last build.

The public app starts empty. No student records, sessions, courses, employer payroll dates, payment records or personal pay settings are included. Hourly rate and deductions default to zero.

## Configure your copy

This is a source release. Course and payroll setup currently lives in two typed configuration files; there is no payroll-calendar editor in the UI.

Before first launch, fill in:

- `src/approvedCourses.ts`: course objects with a unique `id`, a `name`, and an optional `code`.
- `src/payrollSchedule.ts`: period objects with a unique `id`, covered `start` and `end` dates, two week-ending dates in `weeks`, and `submit` and `pay` dates. Dates use `YYYY-MM-DD`.

Set your hourly rate and deductions in Settings. Take-home pay is a percentage-based estimate, not a tax calculation. A rate can include vacation pay; precision is kept until totals are rounded to cents. Amounts are displayed in CAD.

Payroll configuration is saved on first launch and is not overwritten by later builds. Backups must match the configured payroll schedule. Keep any personal configuration in your own local copy.

## Storage

Records live in IndexedDB through Dexie, inside Electron's `TutorTrackPublic` user-data folder. On Windows, this is `%APPDATA%\TutorTrackPublic`. This public build uses its own profile and database.

No account, server or hosted database is required. The desktop window blocks external network requests. Records are local, but not encrypted; access depends on your operating-system account. Use Settings → Export JSON for backups. Import replaces existing records.

## Development

React and TypeScript handle the interface. Vite and Tailwind CSS build the frontend. Electron serves it through a local `tutortrack://app` protocol with a sandboxed renderer and a small backup-export bridge. Zod validates records and imported backups.

```sh
npm test       # Vitest, fake IndexedDB, and rendered UI checks
npm run build  # Type-check and build
npm run format # Format source files
```

Session and payroll logic is in `src/data.ts`, screen layout in `src/App.tsx`, styles in `src/style.css`, and the desktop shell in `desktop/`. Tests cover pay-period boundaries, rounding, backup validation, empty startup and upcoming hours across periods.

## History

The first two commits import sanitized saved source snapshots, followed by public-release preparation. They were committed when this repository was created; they are not a complete or backdated development history.
