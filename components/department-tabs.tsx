'use client';
import {useId} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {departments} from '@/lib/domain';
import {isDepartmentAvailable} from '@/lib/department-availability';

export function DepartmentTabs({value,onChange}:{value:string;onChange:(department:string)=>void}){
 const id=useId(),reduced=useReducedMotion();
 return <nav className="department-switch release-departments" aria-label="Départements">{departments.map((department,index)=><button type="button" key={department.id} data-department={department.id} aria-pressed={value===department.id} className={(value===department.id?'selected ':'')+(!isDepartmentAvailable(department.id)?'upcoming-department':'')} onClick={()=>onChange(department.id)}><span>{String(index+1).padStart(2,'0')}</span><strong>{department.name}</strong><small>{isDepartmentAvailable(department.id)?'Disponible':'Bientôt disponible'}</small>{value===department.id&&<motion.i className="department-active-line" layoutId={id} transition={reduced?{duration:0}:{type:'spring',stiffness:330,damping:32}}/>}</button>)}</nav>;
}
