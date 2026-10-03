import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {db} from './data';
import {importCalendarEvents,type ImportReport} from './calendarImport';

export function CalendarSync({compact=false,onConnect}:{compact?:boolean;onConnect?:()=>void}){
  const [status,setStatus]=useState<GoogleCalendarState>();
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [report,setReport]=useState<ImportReport>();
  useEffect(()=>{if(!report||report.issues.length)return;const timer=setTimeout(()=>setReport(undefined),4000);return()=>clearTimeout(timer);},[report]);
  const [setup,setSetup]=useState(false);
  const api=typeof window==='undefined'?undefined:window.tutortrack?.google;
  useEffect(()=>{let active=true;api?.status().then(value=>{if(active)setStatus(value);}).catch(()=>{if(active)setError('Google connection could not be loaded.');});return()=>{active=false;};},[api]);
  async function run(action:()=>Promise<GoogleCalendarState>){setBusy(true);setError('');try{setStatus(await action());}catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
  async function sync(){
    if(!api||!status?.calendarId)return;
    setBusy(true);setError('');setReport(undefined);
    try{const known=(await db.sync.toArray()).filter(link=>link.calendarId===status.calendarId).map(link=>link.eventId);const result=await api.events(known);setReport(await importCalendarEvents(result.calendarId,result.events));}
    catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);api.status().then(setStatus).catch(()=>{});}
  }
  return <section className={'calendar-sync'+(compact?' calendar-sync-compact':'')} aria-label="Google Calendar sync">
    <div className="inline">
      <button className={compact?'text-button sync-trigger':'secondary'} title={busy?'Syncing…':status?.connected?'Sync Google Calendar':'Connect Google Calendar'} aria-label={busy?'Syncing Google Calendar':status?.connected?'Sync Google Calendar':'Connect Google Calendar'} aria-busy={busy} disabled={busy||!api||!status} onClick={()=>status?.connected?void sync():compact&&onConnect?onConnect():setSetup(!setup)}><RefreshCw size={compact?14:16}/>{!compact&&(busy?'Syncing…':status?.connected?'Sync Google Calendar':'Connect Google Calendar')}</button>
      {!compact&&status?.connected&&<button className="text-button" disabled={busy} onClick={()=>setSetup(!setup)}>Connection</button>}
      {report&&<span className="sync-feedback" role="status">{report.added?`${report.added} event${report.added===1?'':'s'} added`:'No new events'}{report.issues.length?' · Review needed':''}</span>}
    </div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {setup&&api&&<div className="calendar-connection">
      {!status?.configured&&<p className="hint">Import your Google Desktop OAuth client JSON, then connect. Credentials stay encrypted on this computer.</p>}
      <div className="inline">
        <button disabled={busy} onClick={()=>void run(()=>api.importClient())}>{status?.configured?'Change OAuth client':'Import OAuth client'}</button>
        {status?.configured&&!status.connected&&<button disabled={busy} onClick={()=>void run(()=>api.connect())}>Sign in with Google</button>}
        {status?.connected&&<><label>Calendar <select aria-label="Google calendar" disabled={busy} value={status.calendarId} onChange={e=>void run(()=>api.select(e.target.value))}>{status.calendars.map(calendar=><option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.primary?' (main)':''}</option>)}</select></label><button disabled={busy} onClick={()=>void run(()=>api.calendars())}>Refresh calendars</button><button disabled={busy} onClick={()=>void run(()=>api.disconnect())}>Disconnect</button></>}
      </div>
      <p className="hint">Read-only · Past 30 days and next 12 months · Completed and locally edited sessions are preserved.</p>
    </div>}
    {!compact&&report&&report.issues.length>0&&<details className="sync-issues"><summary>Review skipped events</summary><ul>{report.issues.map((issue,index)=><li key={issue.eventId+index}>{issue.message}</li>)}</ul></details>}
  </section>;
}
