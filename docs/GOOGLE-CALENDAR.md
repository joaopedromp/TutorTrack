# Google Calendar

TutorTrack can import events titled **Tutoring Work** from a selected calendar. No hosted server or AI service is needed. The rest of the app works without a Google connection.

## Connect

1. In your own Google Cloud project, enable the Google Calendar API and configure the OAuth consent screen. For a personal testing project, add your Google account as a test user.
2. Create an OAuth client with application type **Desktop app**, then download its JSON file. Do not put this file in the source folder or GitHub.
3. In TutorTrack’s Settings page, choose **Connect Google Calendar → Import OAuth client**, select that file, then **Sign in with Google**.
4. Allow read-only access to calendar events and the calendar list. Your main calendar is selected by default; use Connection to change it.
5. Click **Sync Google Calendar** in Settings or Dashboard → Upcoming sessions to import changes. Review skipped events in Settings.

Google's external Testing mode normally expires refresh tokens after seven days. Reconnect if prompted. Sign-in uses your system browser and a temporary callback bound only to `127.0.0.1`, with PKCE and a random state value. Credentials and tokens are stored in an encrypted file inside the app's user-data folder using Electron safeStorage; they are not exposed to the frontend or included in JSON backups. Disconnect removes the local tokens. To revoke the Google-side grant too, remove the app in your Google Account's connected-app settings.

## Booking format

Use the event's own date, start/end time and location fields. Its description should contain:

```text
Student: Example Learner
Course: CS 101
Topics: Assignment help
Notes: Practice functions
```

The older `Tutoring session with Example Learner (CS 101). Notes…` format also works. Course codes must match a single active course in TutorTrack. Student names are matched without case or spacing differences. Ambiguous or archived matches are flagged rather than guessed.

The [screenshot-to-calendar prompt](CALENDAR-PROMPT.md) is ready to paste into a ChatGPT conversation that has calendar-writing tools. A prompt cannot enable tools that the conversation does not have.

## Sync behavior

- Reads the past 30 days and next 12 months, including recurring instances. It never writes to Google Calendar.
- New sessions are **Scheduled**, with no completed hours. New students are saved for reuse.
- Existing Google event IDs are reused; matching manual sessions are linked without overwriting them.
- Updates unedited imported sessions and applies explicit cancellations. Missing events are never assumed deleted.
- Preserves completed sessions, local edits and locally deleted sessions. Conflicts appear under Review skipped events; no forced overwrite is offered.
- Unknown courses, all-day events or incomplete descriptions are skipped with a review message.

The title identifies bookings; event color does not affect import. Calendar events and credentials stay local and must never be committed to a repository.
