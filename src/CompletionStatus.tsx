import {useEffect,useId,useRef,useState} from 'react';
import {Check} from 'lucide-react';
import {prepareCompletionSound,playCompletionSound} from './completionSound';

export function CompletionStatus({label,done,before,after,onChange}:{label:string;done:boolean;before:string;after:string;onChange:(done:boolean)=>void|Promise<unknown>}){
  const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),undo=useRef<HTMLButtonElement>(null),lock=useRef(false);
  const id=useId();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pulse,setPulse]=useState(false);
  useEffect(()=>setOpen(false),[done]);
  useEffect(()=>{
    if(!open)return;
    undo.current?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  async function change(next:boolean){
    if(lock.current||next===done)return;
    lock.current=true;setBusy(true);setError('');setOpen(false);setPulse(false);
    if(next)prepareCompletionSound();
    try{await onChange(next);if(next){setPulse(true);playCompletionSound()}}
    catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{lock.current=false;setBusy(false);button.current?.focus()}
  }
  return <div ref={root} className={'completion-status '+(after==='Paid'?'payment-completion':'session-completion')+(done?' is-done':'')} aria-busy={busy}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}
    onKeyDown={e=>{if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);button.current?.focus()}}}>
    <div className="completion-segments" role="group" aria-label={label}>
      <button type="button" className="completion-before" data-status={before.toLowerCase()} aria-hidden={done} aria-pressed={!done} disabled={busy||done}>{before}</button>
      <button ref={button} type="button" className={'completion-after'+(pulse?' completion-pulse':'')} data-status={after.toLowerCase()} aria-pressed={done} aria-expanded={open} aria-controls={id} disabled={busy} onAnimationEnd={()=>setPulse(false)} onClick={()=>done?setOpen(!open):void change(true)}><span className="completion-check" aria-hidden="true"><Check size={15}/></span>{after}</button>
    </div>
    {open&&<button ref={undo} id={id} type="button" className="payment-undo" onClick={()=>void change(false)}>Change to {before}</button>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </div>
}
