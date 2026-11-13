'use client';
import {ArrowRight,Clock3} from 'lucide-react';
import {motion,useReducedMotion} from 'framer-motion';
import {departments} from '@/lib/domain';

export function DepartmentComingSoon({department,onInjection}:{department:string;onInjection:()=>void}){
 const reduced=useReducedMotion();
 const name=departments.find(item=>item.id===department)?.name||'Département';
 return <motion.section key={department} initial={reduced?false:{opacity:.45,y:10}} animate={{opacity:1,y:0}} transition={{duration:.25}} className="department-coming-soon" data-department={department} aria-label={name+' — Bientôt disponible'}><span className="coming-soon-icon"><Clock3 size={30} strokeWidth={1.5}/></span><span className="section-kicker">{name}</span><h2>Bientôt disponible</h2><p>Cet espace sera disponible prochainement.</p><button type="button" className="button primary" onClick={onInjection}>Revenir à l’injection<ArrowRight size={16}/></button></motion.section>;
}
