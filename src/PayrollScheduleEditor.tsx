import {useState, type FormEvent} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {db, fmtDate, savePayrollPeriod, uid} from './data';

export function PayrollSchedule() {
  const periods = useLiveQuery(() => db.periods.orderBy('start').toArray()) || [];
  const [adding,setAdding] = useState(false);
  const [start,setStart] = useState(''),[end,setEnd] = useState(''),[submit,setSubmit] = useState(''),[pay,setPay] = useState('');
  const [error,setError] = useState(''),[busy,setBusy] = useState(false);
  async function save(e:FormEvent) {
    e.preventDefault(); if(busy)return; setBusy(true); setError('');
    try {
      const firstWeek = new Date(start+'T12:00:00'); firstWeek.setDate(firstWeek.getDate()+6);
      const day = `${firstWeek.getFullYear()}-${String(firstWeek.getMonth()+1).padStart(2,'0')}-${String(firstWeek.getDate()).padStart(2,'0')}`;
      await savePayrollPeriod({id:uid(),start,end,submit,pay,weeks:[day>end?end:day,end]});
      setAdding(false); setStart(''); setEnd(''); setSubmit(''); setPay('');
    } catch(e) {setError(e instanceof Error?e.message:String(e));} finally {setBusy(false);}
  }
  return <details className="panel settings-schedule"><summary>Payroll schedule</summary>
    <p className="hint">Add dates from your employer’s schedule.</p>
    <div className="payroll-schedule-list">{periods.map(p=><div key={p.id}><span>{fmtDate(p.start)} – {fmtDate(p.end)}, {p.start.slice(0,4)}</span><span>Pay {fmtDate(p.pay)}</span></div>)}</div>
    {!adding?<button className="text-button" onClick={()=>setAdding(true)}>Add pay period</button>:<form onSubmit={save}>
      <div className="schedule-fields"><label>Start<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>End<input required type="date" value={end} min={start} onChange={e=>setEnd(e.target.value)}/></label><label>Submit by<input required type="date" value={submit} min={end} onChange={e=>setSubmit(e.target.value)}/></label><label>Pay date<input required type="date" value={pay} min={end} onChange={e=>setPay(e.target.value)}/></label></div>
      {error&&<p className="form-error" role="alert">{error}</p>}<div className="inline"><button type="button" disabled={busy} onClick={()=>setAdding(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save period'}</button></div>
    </form>}
  </details>;
}
