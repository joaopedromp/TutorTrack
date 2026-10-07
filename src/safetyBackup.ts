import {exportData} from './data';

// A failed backup blocks the destructive operation; these files stay in the private app profile.
export async function safetyBackup() {
  if (!window.tutortrack?.safetyBackup) throw Error('Automatic backup is unavailable. Restart the updated desktop app before restoring or clearing records.');
  const saved = await window.tutortrack.safetyBackup(JSON.stringify(await exportData()));
  if (!saved) throw Error('The automatic backup was not saved. Your records have not been changed.');
}
