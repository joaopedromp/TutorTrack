import {useState} from 'react';
import {X} from 'lucide-react';

export function PaycheckReminder({date,amount,onOpen}:{date:string;amount:string;onOpen:()=>void}){
  const [hidden,setHidden]=useState(false);
  if(hidden)return <button className="paycheck-reopen" onClick={()=>setHidden(false)} title="Show next paycheck"><span className="paycheck-dot"/>Next paycheck</button>;
  return <section className="paycheck-reminder" aria-label="Next paycheck">
    <button className="paycheck-reminder-content" onClick={onOpen} title="View paycheck">
      <span className="paycheck-reminder-label"><span className="paycheck-dot"/>Next paycheck</span>
      <span className="paycheck-reminder-detail">{date}<span className="paycheck-separator">·</span><span>{amount}</span></span>
    </button>
    <button className="paycheck-dismiss" onClick={()=>setHidden(true)} aria-label="Hide paycheck reminder" title="Hide paycheck reminder"><X size={12}/></button>
  </section>;
}
