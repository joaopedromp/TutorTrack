# TutorTrack

An offline desktop app for tracking tutoring sessions, students and pay.

![TutorTrack dashboard with an empty database](docs/dashboard.png)

## Features

- Schedule sessions and manage students and courses.
- Track completed hours, upcoming sessions and estimated pay.
- Mark pay periods as paid and back up records to JSON.
- Import Google Calendar bookings with a [read-only sync button](docs/GOOGLE-CALENDAR.md).

## Latest update

The dashboard now puts the current pay period first visually, with a smaller next-paycheck summary and clearer take-home amounts. Upcoming sessions sit beside recent activity, with wider 1-on-1, Walk-in and All filters. Calendar sync is a small refresh button; dates and times stay aligned across the lists.

The original dark colors, type and navigation icons are preserved. This repository starts empty and includes no personal records, pay settings, calendar credentials or private schedules. The Walk-in filter uses courses named “Walk-in tutoring”; it does not install a recurring schedule.

## Built with

React · TypeScript · Electron · Vite · Tailwind CSS · Dexie · Zod · Vitest

