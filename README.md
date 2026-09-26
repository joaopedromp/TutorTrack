# TutorTrack

An offline desktop app for tracking tutoring sessions, students and pay.

![TutorTrack dashboard with an empty database](docs/dashboard.png)

## Features

- Schedule sessions and manage students and courses.
- Track completed hours, upcoming sessions and estimated pay.
- Mark pay periods as paid and back up records to JSON.
- Import Google Calendar bookings with a [read-only sync button](docs/GOOGLE-CALENDAR.md).

## Run locally

Requires Node.js 22.12 or later. Windows is the tested platform.

```sh
npm ci
npm test
npm run desktop
```

The app starts empty. Before first launch, configure your courses and payroll dates using the [setup guide](docs/SETUP.md). Set your hourly rate and deduction percentage in Settings.

Records stay on your computer. No account or server is needed.

## Built with

React · TypeScript · Electron · Vite · Tailwind CSS · Dexie · Zod · Vitest
