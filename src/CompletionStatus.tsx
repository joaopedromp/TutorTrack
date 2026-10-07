import {useEffect,useRef,useState} from 'react';
import {Check} from 'lucide-react';
import {prepareCompletionSound,playCompletionSound} from './completionSound';

export function CompletionStatus({label,done,before,after,onChange,sound=true}:{label:string;done:boolean;before:string;after:string;onChange:(done:boolean)=>void|Promise<unknown>;sound?:boolean}){
  const button=useRef<HTMLButtonElement>(null),lock=useRef(false);

  const [visibleDone,setVisibleDone]=useState(done);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[pulse,setPulse]=useState(false);
  useEffect(()=>{setVisibleDone(done)},[done]);
  async function change(next:boolean){
    if(lock.current||next===visibleDone)return;
    lock.current=true;setBusy(true);setError('');setPulse(next);setVisibleDone(next);
    if(next&&sound)prepareCompletionSound();
    try{await onChange(next);if(next&&sound)playCompletionSound()}
    catch(e){setVisibleDone(done);setPulse(false);setError(e instanceof Error?e.message:String(e))}
    finally{lock.current=false;setBusy(false);button.current?.focus()}
  }
  const action='Change to '+(visibleDone?before:after).toLowerCase();
  return <div className="single-status" aria-busy={busy} role="group" aria-label={label}>
    <button ref={button} type="button" className={'single-status-button'+(visibleDone?' done':'')+(pulse?' changed':'')} data-status={(visibleDone?after:before).toLowerCase()} title={action} aria-pressed={visibleDone} disabled={busy} onAnimationEnd={()=>setPulse(false)} onClick={()=>void change(!visibleDone)}>
      {visibleDone&&<Check className="single-status-check" size={14} aria-hidden="true"/>}<span>{visibleDone?after:before}</span>
    </button>
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>
}