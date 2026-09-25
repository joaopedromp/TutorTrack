# Setup

This source release starts with no records, courses or payroll dates. Hourly rate and deductions default to zero.

Before running `npm run desktop`, configure:

- `src/approvedCourses.ts`: course objects with a unique `id`, a `name`, and an optional `code`.
- `src/payrollSchedule.ts`: period objects with a unique `id`, covered `start` and `end` dates, two week-ending dates in `weeks`, and `submit` and `pay` dates. Dates use `YYYY-MM-DD`.

There is no payroll-calendar editor in the UI. Payroll configuration is saved on first launch and is not overwritten by later builds. Backups must match the configured schedule. Keep personal configuration in your local copy.

Set your hourly rate and deductions in Settings. Take-home pay is a percentage-based estimate in CAD, not a tax calculation.

## Storage and backups

Records are stored in IndexedDB within `%APPDATA%\TutorTrackPublic` on Windows. They are local but not encrypted. Export JSON in Settings creates a backup; import replaces current records.

## Commands

The first launch downloads Electron; subsequent launches work offline.

```sh
npm run desktop # Build and open the app
npm start       # Open the last build
npm test        # Run tests
npm run build   # Type-check and build
npm run format  # Format source files
```
