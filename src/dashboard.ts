import type {Session,Course} from './data';
export type UpcomingFilter='one'|'walk'|'all';
const normalized=(value:string)=>value.trim().toLowerCase().replace(/[‐‑‒–—]/g,'-');
export function filterUpcoming(sessions:Session[],courses:Course[],filter:UpcomingFilter){
  const walkCourses=new Set(courses.filter(course=>normalized(course.name)==='walk-in tutoring').map(course=>course.id));
  return sessions.filter(session=>{const walk=walkCourses.has(session.courseId);return filter==='all'||(filter==='walk'?walk:!walk);});
}
