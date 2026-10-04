import type {Session} from './data';
export function compareSessions(a:Session,b:Session,order:string,at=Date.now()){
if(order!=='next')return (order==='newest'?-1:1)*(Date.parse(a.scheduledStart)-Date.parse(b.scheduledStart));
const rank=(s:Session)=>s.status==='scheduled'&&!s.eventCancelled?(Date.parse(s.scheduledEnd)>at?0:1):s.status==='completed'?2:3;
const ar=rank(a),br=rank(b);return ar-br||(ar<2?Date.parse(a.scheduledStart)-Date.parse(b.scheduledStart):Date.parse(b.actualStart||b.scheduledStart)-Date.parse(a.actualStart||a.scheduledStart));
}
