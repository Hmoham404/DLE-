'use client';

import {useEffect,useId,type ReactNode} from 'react';
import {motion,MotionConfig,useAnimationControls,useMotionValue,useReducedMotion,useSpring} from 'framer-motion';
import {Activity,CheckCheck,ClipboardList,LayoutGrid,MonitorPlay,Moon,Sun} from 'lucide-react';

export type WorkspaceView='entry'|'meeting'|'machines'|'five-s';
export function IndustrialMotion({children}:{children:ReactNode}){
 return <MotionConfig reducedMotion="user" transition={{duration:.24,ease:[.22,1,.36,1]}}>{children}</MotionConfig>;
}
export function IndustrialNavigation({value,onChange}:{value:WorkspaceView;onChange:(view:WorkspaceView)=>void}){
 const id=useId(),reduced=useReducedMotion();
 return <nav className="main-nav industrial-nav" aria-label="Espaces de travail">{[
  {id:'entry',label:'Saisie',icon:ClipboardList},{id:'meeting',label:'Réunion',icon:MonitorPlay},
  {id:'machines',label:'Machines',icon:LayoutGrid},{id:'five-s',label:'5S usine',icon:CheckCheck}
 ].map(item=><button type="button" key={item.id} className={value===item.id?'selected':''} aria-current={value===item.id?'page':undefined} onClick={()=>onChange(item.id as WorkspaceView)}>
  {value===item.id&&<motion.span className="nav-active-surface" layoutId={id} transition={reduced?{duration:0}:{type:'spring',stiffness:380,damping:34}}/>}<item.icon size={17} strokeWidth={1.7}/><span className="nav-label">{item.label}</span>
 </button>)}</nav>;
}
export function MeetingThemeToggle({dark,onToggle}:{dark:boolean;onToggle:()=>void}){
 return <button type="button" className="theme-toggle" onClick={onToggle} aria-label={dark?'Activer le mode clair':'Activer le mode sombre'} aria-pressed={dark} title={dark?'Passer en mode clair':'Passer en mode sombre'}>{dark?<Sun size={17}/>:<Moon size={17}/>}<span>{dark?'Mode clair':'Mode sombre'}</span></button>;
}
export function WorkspaceSurface({section,children}:{section:string;children:ReactNode}){
 const controls=useAnimationControls(),reduced=useReducedMotion();
 useEffect(()=>{if(reduced){controls.set({opacity:1,y:0});return;}void controls.start({opacity:[.65,1],y:[8,0],transition:{duration:.3}});},[section,controls,reduced]);
 return <motion.main id="main-content" tabIndex={-1} className="workspace" animate={controls}>{children}</motion.main>;
}
export function IndustrialCard({children,className='',label}:{children:ReactNode;className?:string;label?:string}){
 const reduced=useReducedMotion(),x=useMotionValue(0),y=useMotionValue(0);
 const rotateX=useSpring(x,{stiffness:220,damping:30}),rotateY=useSpring(y,{stiffness:220,damping:30});
 return <motion.article className={'industrial-card '+className} aria-label={label} style={{rotateX:reduced?0:rotateX,rotateY:reduced?0:rotateY,transformPerspective:1100}}
  onPointerMove={event=>{if(reduced||event.pointerType!=='mouse')return;const r=event.currentTarget.getBoundingClientRect();x.set(-(event.clientY-r.top-r.height/2)/r.height*3);y.set((event.clientX-r.left-r.width/2)/r.width*3);}}
  onPointerLeave={()=>{x.set(0);y.set(0);}}>{children}</motion.article>;
}
export function MetricValue({value}:{value:number|null}){
 const reduced=useReducedMotion();
 const text=value===null?'—':new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(value)+' %';
 return <motion.strong key={text} initial={reduced?false:{opacity:.35,y:5}} animate={{opacity:1,y:0}}>{text}</motion.strong>;
}
export function ValidationStatus({dirty,status}:{dirty:boolean;status:'draft'|'validated'}){
 const reduced=useReducedMotion(),validated=!dirty&&status==='validated';
 return <motion.span key={dirty?'dirty':status} initial={reduced?false:{opacity:.4,scale:.96}} animate={{opacity:1,scale:1}} className={'document-status '+(dirty?'dirty':status)} role="status">{validated?<CheckCheck size={14}/>:<i/>}{dirty?'Modifications non enregistrées':validated?'Validé pour la réunion':'Brouillon'}</motion.span>;
}
export function LiveWorkspaceLabel({meeting}:{meeting:boolean}){
 return <div className="workspace-ribbon"><span><Activity size={13}/>MYC SMART PRODUCTION</span><span>{meeting?'PILOTAGE INDUSTRIEL':'ESPACE OPÉRATIONNEL'}</span></div>;
}
