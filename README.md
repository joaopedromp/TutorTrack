# TutorTrack

An offline desktop app for tracking tutoring sessions, students and pay.

![TutorTrack dashboard with an empty database](docs/dashboard.png)

## Features

- Schedule sessions and manage students and courses.
- Track completed hours, upcoming sessions and estimated pay.
- Mark pay periods as paid and back up records to JSON.
- Import Google Calendar bookings with a [read-only sync button](docs/GOOGLE-CALENDAR.md).

## Latest update

Session details are more compact, with direct Scheduled / Completed controls. Payment status saves with one click. In Payroll and paycheck details, marking a payment Paid smoothly collapses the control to a small green button. Click Paid to change it back to Upcoming. Session completion now uses the same green checkmark, gentle animation and quiet two-note chime. Click Completed to switch back to Scheduled. A small clock opens worked-time adjustments. Reduced-motion preferences are respected; sounds do not play when existing records are opened. Sessions open with the nearest upcoming work first; All, 1-on-1 and Walk-in filters keep the list easy to scan.

The original dark colors, type and navigation icons are preserved. This repository starts empty and includes no personal records, pay settings, calendar credentials or private schedules. The Walk-in filter uses courses named “Walk-in tutoring”; it does not install a recurring schedule.

## Built with

React · TypeScript · Electron · Vite · Tailwind CSS · Dexie · Zod · Vitest
