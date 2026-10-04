import {it,expect} from 'vitest';
import {compareSessions} from '../src/sessionOrder';
import type {Session} from '../src/data';
it('puts the nearest scheduled work first, then overdue work and recent completed history',()=>{
const row=(id:string,start:string,status='scheduled')=>({id,scheduledStart:start,scheduledEnd:new Date(Date.parse(start)+3600000).toISOString(),status,eventCancelled:status==='cancelled',actualStart:status==='completed'?start:''} as Session);
const sessions=[row('far','2030-12-01T10:00:00Z'),row('older','2030-09-01T10:00:00Z','completed'),row('near','2030-10-05T10:00:00Z'),row('recent','2030-10-02T10:00:00Z','completed'),row('overdue','2030-10-01T10:00:00Z'),row('cancelled','2030-10-04T10:00:00Z','cancelled')];
expect(sessions.sort((a,b)=>compareSessions(a,b,'next',Date.parse('2030-10-03T00:00:00Z'))).map(s=>s.id)).toEqual(['near','far','overdue','recent','older','cancelled']);
expect([...sessions].sort((a,b)=>compareSessions(a,b,'newest'))[0].id).toBe('far');
});
