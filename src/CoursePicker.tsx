import {useState} from 'react';
import {courseLabel,type Course} from './data';

export function CoursePicker({courses,value,onChange}:{courses:Course[];value:string;onChange:(id:string)=>void}){
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const selected=courses.find(c=>c.id===value);
  const options=courses.filter(c=>!c.archived).filter(c=>courseLabel(c).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(!!b.code)-Number(!!a.code)||(a.code||a.name).localeCompare(b.code||b.name));
  return <div className="course-picker"><span className="course-label">Course</span><button type="button" className="course-trigger" aria-label="Choose course" aria-expanded={open} onClick={()=>setOpen(!open)}><span>{selected?courseLabel(selected):'Select a course'}</span><span aria-hidden="true">⌄</span></button>{open&&<div className="course-options"><input aria-label="Search courses" placeholder="Search code or course name" value={search} onChange={e=>setSearch(e.target.value)}/><div className="course-option-list" role="group" aria-label="Courses">{options.map(c=><button type="button" key={c.id} className={c.id===value?'chosen':''} aria-pressed={c.id===value} onClick={()=>{onChange(c.id);setOpen(false);setSearch('');}}>{c.code&&<strong>{c.code}</strong>}<span>{c.name}</span></button>)}{!options.length&&<p className="hint">No matching courses</p>}</div></div>}</div>;
}
