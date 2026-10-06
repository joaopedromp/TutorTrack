# TutorTrack

An offline desktop app for tracking tutoring sessions, students and pay.

![TutorTrack dashboard with an empty database](docs/dashboard.png)

## Features

- Schedule sessions and manage students and courses.
- Track completed hours, upcoming sessions and estimated pay.
- Mark pay periods as paid and back up records to JSON.
- Import Google Calendar bookings with a [read-only sync button](docs/GOOGLE-CALENDAR.md).

## Latest update

Settings now use a consistent single-column layout with compact earnings inputs, aligned calendar and backup actions, shorter course rows, and local-data controls under Advanced. Backup validation and deletion confirmation remain in place.


Students now use compact, evenly aligned cards with names and completed hours, without fixed subjects. Students and Sessions have a small plus beside the heading; Payroll no longer shows Add session.


Payment and session status now show one compact button. Click to mark Paid or Completed, and click again to switch back; hover text explains the action. The green checkmark and quiet chime remain. Session details keep the same height when status changes, with the unused worked-time adjustment removed. Existing recorded hours are preserved. The current pay period card also has slightly tighter vertical spacing.

The original dark colors, type and navigation icons are preserved. This repository starts empty and includes no personal records, pay settings, calendar credentials or private schedules. The Walk-in filter uses courses named “Walk-in tutoring”; it does not install a recurring schedule.

## Built with

React · TypeScript · Electron · Vite · Tailwind CSS · Dexie · Zod · Vitest
