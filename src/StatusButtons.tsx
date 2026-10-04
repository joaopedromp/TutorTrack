import {useEffect,useId,useRef,useState} from 'react';
import {setPaymentStatus} from './data';
export function StatusButtons({label,value,options,onChange,disabled=false}:{label:string;value:string;options:{value:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean}){return <div className="status-buttons" role="group" aria-label={label}>{options.map(option=><button type="button" key={option.value} data-status={option.value} aria-pressed={value===option.value} disabled={disabled} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div>}
export function PaymentStatus({periodId,value,label}:{periodId:string;value:string;label:string}){
  const lock=useRef(false),root=useRef<HTMLDivElement>(null),paidButton=useRef<HTMLButtonElement>(null),undoButton=useRef<HTMLButtonElement>(null);
  const menuId=useId();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false);
  const paid=value==='paid';
  useEffect(()=>{setOpen(false)},[periodId,value]);
  useEffect(()=>{
    if(!open)return;
    undoButton.current?.focus();
    function outside(event:PointerEvent){if(!root.current?.contains(event.target as Node))setOpen(false)}
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  async function change(next:'paid'|'upcoming'){
    if(lock.current||next===value)return;
    lock.current=true;setBusy(true);setError('');setOpen(false);
    try{await setPaymentStatus(periodId,next)}catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{lock.current=false;setBusy(false);paidButton.current?.focus()}
  }
  return <div ref={root} className={'payment-status'+(paid?' is-paid':'')} aria-busy={busy}
    onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}}
    onKeyDown={event=>{if(event.key==='Escape'&&open){event.stopPropagation();setOpen(false);paidButton.current?.focus()}}}>
    <div className="status-buttons payment-segments" role="group" aria-label={label}>
      <button type="button" data-status="upcoming" aria-pressed={!paid} aria-hidden={paid} disabled={busy||paid}>Upcoming</button>
      <button ref={paidButton} type="button" data-status="paid" aria-pressed={paid} aria-expanded={open} aria-controls={menuId} disabled={busy} onClick={()=>paid?setOpen(!open):void change('paid')}>Paid</button>
    </div>
    {open&&<button ref={undoButton} id={menuId} type="button" className="payment-undo" disabled={busy} onClick={()=>void change('upcoming')}>Change to Upcoming</button>}
    {error&&<p role="alert" className="form-error">{error}</p>}
  </div>
}
