import {describe,it,expect} from 'vitest';
import {filterUpcoming} from '../src/dashboard';
import type {Session,Course} from '../src/data';
const courses=[{id:'group',name:'Walk-in tutoring',archived:true},{id:'individual',name:'Algebra'}] as Course[];
const sessions=[{id:'first',courseId:'individual'},{id:'second',courseId:'group'},{id:'third',courseId:'individual'}] as Session[];
describe('upcoming category filters',()=>{
 it('keeps the original chronological order and records when switching categories',()=>{
 expect(filterUpcoming(sessions,courses,'one').map(s=>s.id)).toEqual(['first','third']);
 expect(filterUpcoming(sessions,courses,'walk').map(s=>s.id)).toEqual(['second']);
 expect(filterUpcoming(sessions,courses,'all')).toEqual(sessions);
 expect(sessions).toHaveLength(3);
 });
 it('recognizes an existing archived course without confusing a student name or partial course match',()=>{
 const variants=[{id:'group',name:' Walk–in Tutoring '},{id:'individual',name:'Walk-in tutoring preparation'}] as Course[];
 expect(filterUpcoming(sessions,variants,'walk').map(s=>s.id)).toEqual(['second']);
 expect(filterUpcoming(sessions,[],'one')).toEqual(sessions);
 });
});
