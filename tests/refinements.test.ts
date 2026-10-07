import 'fake-indexeddb/auto';
import {beforeEach, expect, it} from 'vitest';
import {db, defaults, exportData, importData, isActivity, now, periodTotals, saveEarnings, savePayrollPeriod, setPaymentStatus, studentSchema, validateBackup, type Session, type Student} from '../src/data';
import {filterUpcoming} from '../src/dashboard';

const period={id:'period',start:'2030-01-01',end:'2030-01-14',weeks:['2030-01-07','2030-01-14'] as [string,string],submit:'2030-01-15',pay:'2030-01-20'};
const student:Student={id:'person',name:'Example person',courseId:'course',note:'Keep this note',archived:false,createdAt:now()};
const session:Session={id:'session',studentId:'person',courseId:'course',title:'Tutoring',status:'completed',scheduledStart:'2030-01-02T14:00:00Z',scheduledEnd:'2030-01-02T15:00:00Z',actualStart:'2030-01-02T14:00:00Z',actualEnd:'2030-01-02T15:00:00Z',topics:'Original topic',notes:'Original note',updatedAt:now(),scheduleUpdatedAt:now(),deleted:false,eventCancelled:false};
beforeEach(async()=>{await db.transaction('rw',db.tables,async()=>{for(const table of db.tables)await table.clear();});await db.settings.put({...defaults,wage:30,deduction:10});await db.periods.put(period);await db.courses.put({id:'course',name:'Example course'});await db.students.put(student);await db.sessions.put(session);});

it('allows a person without a permanent subject and preserves the explicit activity type through backup',async()=>{
  await db.students.put(studentSchema.parse({...student,courseId:'',kind:'activity'}));
  await importData(await exportData());
  expect(await db.students.get(student.id)).toMatchObject({courseId:'',kind:'activity',note:'Keep this note'});
  expect(await db.sessions.get(session.id)).toMatchObject({courseId:'course',notes:'Original note'});
});
it('supports legacy activity names but honors an explicit student classification',()=>{
  expect(isActivity({...student,name:'Training'})).toBe(true);
  expect(isActivity({...student,name:'Training',kind:'student'})).toBe(false);
  expect(isActivity({...student,name:'Group workshop',kind:'activity'})).toBe(true);
  expect(filterUpcoming([session],[{id:'course',name:'Example course'}],'one',[{...student,kind:'activity'}])).toEqual([]);
  expect(filterUpcoming([session],[],'all',[{...student,kind:'activity'}])).toEqual([session]);
});
it('freezes the paid period rate without altering recorded hours or payment metadata',async()=>{
  await db.payments.put({id:'payment',periodId:period.id,status:'upcoming',deposit:12,depositDate:'2030-01-20',note:'Existing note'});
  await setPaymentStatus(period.id,'paid');
  await saveEarnings({...defaults,wage:60,deduction:20});
  const saved=(await db.periods.get(period.id))!;
  expect(periodTotals([session],{...defaults,wage:60,deduction:20},saved)).toEqual({mins:60,gross:30,deductions:3,net:27});
  await setPaymentStatus(period.id,'upcoming');
  expect(await db.payments.get('payment')).toMatchObject({deposit:12,note:'Existing note',status:'upcoming'});
  expect(await db.sessions.get(session.id)).toMatchObject({actualStart:session.actualStart,actualEnd:session.actualEnd});
});
it('preserves closed period rates when settings change but updates unsnapshotted future periods',async()=>{
  await db.periods.put({...period,id:'past',start:'2020-01-01',end:'2020-01-14',weeks:['2020-01-07','2020-01-14'],submit:'2020-01-15',pay:'2020-01-20'});
  await saveEarnings({...defaults,wage:45,deduction:20});
  expect((await db.periods.get('past'))?.rates).toEqual({wage:30,deduction:10});
  expect((await db.periods.get(period.id))?.rates).toBeUndefined();
});
it('accepts future payroll schedules and rejects overlapping or invalid backups without changing records',async()=>{
  await savePayrollPeriod({...period,id:'next',start:'2030-01-15',end:'2030-01-28',weeks:['2030-01-21','2030-01-28'],submit:'2030-01-29',pay:'2030-02-03'});
  const backup=await exportData(); expect(validateBackup(backup).periods).toHaveLength(2);
  await expect(savePayrollPeriod({...period,id:'overlap'})).rejects.toThrow('overlap');
  await expect(importData({...backup,periods:[{...period,end:'2029-12-31'}]})).rejects.toThrow();
  expect(await db.periods.count()).toBe(2);expect(await db.sessions.count()).toBe(1);
});
