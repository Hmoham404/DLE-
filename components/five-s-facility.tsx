'use client';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {Component,useCallback,useRef,useState,type ReactNode,type MouseEvent as ReactMouseEvent} from 'react';
import {ArrowRight,Box,CalendarCheck,ChevronRight,FileDown,Layers,MapPin,Maximize2,Minus,Plus,RotateCcw,Tag,X} from 'lucide-react';
import type {Machine} from '@/lib/domain';
import {auditScore,type FiveSAudit} from '@/lib/five-s-audits';
import {facilityMachines,type MapMachine} from '@/lib/five-s-machines';
import {fiveSPlans,fiveSCode,type FiveSTag} from '@/lib/five-s';
import {facilityLayouts,zoneCategories,zoneColors,tagColors,tagsInZone,zoneAt,zoneCenter,type FacilityZone,type PlanId,type PlanPoint} from '@/lib/five-s-layout';
import type {FacilityCamera} from './five-s-facility-scene';

const Scene=dynamic(()=>import('./five-s-facility-scene'),{ssr:false,loading:()=> <div className="facility-loading"><Box size={32}/><span>Construction de la maquette…</span></div>});
class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
type Props={plan:PlanId;tags:FiveSTag[];machines:Machine[];audits:FiveSAudit[];canEdit:boolean;placing:boolean;onPlanChange:(plan:PlanId)=>void;onPlace:(plan:PlanId,point:PlanPoint,zone?:FacilityZone,machine?:MapMachine)=>void;onCreate:(plan:PlanId,zone:FacilityZone)=>void;onAudit:(machine:MapMachine)=>void;onMachineTag:(machine:MapMachine)=>void;onOpenAudit:(audit:FiveSAudit)=>void;onOpenTag:(tag:FiveSTag)=>void;onCancel:()=>void};

function VectorPlan({plan,tags,machines,selectedMachine,onSelectMachine,selected,placing,onSelect,onOpenTag}:{plan:PlanId;tags:FiveSTag[];machines:MapMachine[];selectedMachine:string|null;onSelectMachine:(machine:MapMachine)=>void;selected:string|null;placing:boolean;onSelect:(zone:FacilityZone,point:PlanPoint)=>void;onOpenTag:(tag:FiveSTag)=>void}){
 const layout=facilityLayouts[plan],b=layout.bounds;
 const click=(zone:FacilityZone,event:ReactMouseEvent<SVGGElement>)=>{
  const svg=event.currentTarget.ownerSVGElement,matrix=svg?.getScreenCTM();
  if(!matrix)return;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  onSelect(zone,{x:point.x,y:point.y/.707});
 };
 return <svg className={'facility-vector '+(placing?'placing':'')} viewBox={`${b.x-1} ${(b.y-1)*.707} ${b.w+2} ${(b.h+2)*.707}`} aria-label={'Plan 2D reconstruit du '+layout.name}>
  <g transform="scale(1 .707)">
   <rect x={b.x-.4} y={b.y-.4} width={b.w+.8} height={b.h+.8} fill="#2e4947" stroke="#9caf9f" strokeWidth=".2"/>
   {layout.aisles.map((r,i)=><rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="#6c9177"/>)}
   {layout.zones.map((zone,index)=>{const r=zone.rect,active=zone.id===selected;return <g key={zone.id} role="button" tabIndex={0} aria-label={'Sélectionner '+zone.name} aria-pressed={active} onClick={event=>click(zone,event)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(zone,zoneCenter(zone));}}} className="facility-vector-zone">
    <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={active?'#406e5a':zone.category==='stockage'?'#4e4b3b':'#2c494b'} stroke={active?'#c5f5bd':zoneColors[zone.category]} strokeWidth={active?.35:.15}/>
    <text x={r.x+.6} y={r.y+1.8} fill={zoneColors[zone.category]} fontSize="1.2">{String(index+1).padStart(2,'0')}</text>
    {r.w>8&&!machines.some(item=>item.zone.id===zone.id)&&<text x={r.x+r.w/2} y={r.y+r.h/2} textAnchor="middle" fill="#e4eee8" fontSize="1.35">{zone.short}</text>}
   </g>;})}
   {machines.map(item=>{const active=selectedMachine===item.machine.id;return <g key={item.machine.id} className="facility-vector-machine" role="button" tabIndex={0} aria-label={'Sélectionner la machine '+item.machine.name} aria-pressed={active} onClick={event=>{event.stopPropagation();onSelectMachine(item);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSelectMachine(item);}}}>
    <title>{item.machine.name}</title><rect x={item.position.x-item.size.w/2} y={item.position.y-item.size.h/2} width={item.size.w} height={item.size.h} rx=".35" fill={active?'#e8c979':'#a8c6b6'} stroke={active?'#fff0b5':'#e1ede4'} strokeWidth={active?.35:.12}/>
    <rect x={item.position.x-item.size.w*.35} y={item.position.y-item.size.h*.35} width={item.size.w*.7} height={item.size.h*.35} fill="#426b62"/>
    <text x={item.position.x} y={item.position.y+item.size.h*.33} textAnchor="middle" fill="#102f2a" fontSize={Math.min(1.5,item.size.w*.4)} fontWeight="600" pointerEvents="none">{item.label}</text>
   </g>;})}
   {tags.filter(tag=>tag.position).map(tag=><g role="button" tabIndex={placing?-1:0} key={tag.id} aria-label={fiveSCode(tag)+' · '+tag.title} onClick={event=>{event.stopPropagation();if(!placing)onOpenTag(tag);}} onKeyDown={event=>{if(!placing&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onOpenTag(tag);}}} className="facility-vector-tag">
    <circle cx={tag.position!.x} cy={tag.position!.y} r=".85" fill={tag.status==='Clôturée'?'#173033':tagColors[tag.color]} stroke={tagColors[tag.color]} strokeWidth=".3"/><title>{tag.title} · {tag.location}</title>
   </g>)}
  </g>
 </svg>;
}

export function FiveSFacility({plan,tags,machines,audits,canEdit,placing,onPlanChange,onPlace,onCreate,onAudit,onMachineTag,onOpenAudit,onOpenTag,onCancel}:Props){
 const [mode,setMode]=useState<'3d'|'2d'>('3d'),[selected,setSelected]=useState<string|null>(null),[camera,setCamera]=useState<FacilityCamera>({top:false,zoom:1,revision:0}),[unavailable,setUnavailable]=useState(false),[full,setFull]=useState(false),[sourcesOpen,setSourcesOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),layout=facilityLayouts[plan],zone=layout.zones.find(item=>item.id===selected),siteTags=tags.filter(tag=>tag.plan_id===plan),zoneTags=zone?tagsInZone(siteTags,plan,zone):[];
 const [machineId,setMachineId]=useState<string|null>(null),[listMode,setListMode]=useState<'machines'|'zones'>('machines');
 const mapMachines=facilityMachines(machines,plan),selectedMachine=mapMachines.find(item=>item.machine.id===machineId);
 const machineAudits=audits.filter(audit=>audit.machine_id===selectedMachine?.machine.id).sort((a,b)=>b.scheduled_date.localeCompare(a.scheduled_date)||(b.created_at||'').localeCompare(a.created_at||''));
 const unavailableHandler=useCallback(()=>setUnavailable(true),[]);
 const select=(next:FacilityZone,point:PlanPoint)=>{setMachineId(null);setSelected(next.id);if(placing)onPlace(plan,point,next);};
 const selectMachine=(item:MapMachine)=>{setMachineId(item.machine.id);setSelected(null);if(placing)onPlace(plan,item.position,item.zone,item);};
 const reset=()=>setCamera({top:false,zoom:1,revision:camera.revision+1});
 const changeSite=(id:PlanId)=>{if(placing)return;onPlanChange(id);setSelected(null);setMachineId(null);reset();};
 const fallback=<div className="facility-no-webgl"><Layers size={28}/><strong>Le plan 2D reste disponible</strong><p>Le rendu 3D n’est pas disponible dans ce navigateur.</p><button type="button" onClick={()=>setMode('2d')}>Ouvrir le plan 2D<ArrowRight size={15}/></button></div>;
 return <section className="facility-section" aria-label="Exploration de l’usine et repérage 5S">
  <div className="five-s-section-heading"><div><span className="section-kicker">01 / CARTE DES MACHINES</span><h2>Cliquez sur une machine.</h2></div><p className="facility-heading-note">1. Sélectionner une machine · 2. Planifier son audit 5S</p></div>
  <div ref={root} className={'facility-shell '+(full?'facility-expanded':'')}>
   <header className="facility-toolbar"><div className="facility-sites" aria-label="Site à explorer">{fiveSPlans.map((site,index)=><button key={site.id} disabled={placing} aria-pressed={plan===site.id} onClick={()=>changeSite(site.id)}><span>0{index+1}</span>{site.name}</button>)}</div><div className="facility-views" aria-label="Mode d’affichage"><button aria-pressed={mode==='3d'} onClick={()=>setMode('3d')}><Box size={15}/>Maquette 3D</button><button aria-pressed={mode==='2d'} onClick={()=>setMode('2d')}><Layers size={15}/>Plan 2D</button></div></header>
   {placing&&<div className="facility-placement" role="status"><MapPin size={17}/><span>Choisissez un emplacement dans une zone de la maquette ou du plan 2D.</span><button onClick={onCancel}><X size={14}/>Annuler</button></div>}
   <div className="facility-body"><div className="facility-stage">
    <div className="facility-stage-label"><i/><span>{layout.name}<small>RECONSTITUTION D’APRÈS LE PLAN MYC</small></span></div>
    <div className="facility-stage-count"><strong>{mapMachines.length}</strong><span>machines et lignes</span></div>
    <div className="facility-viewport">{mode==='3d'?unavailable?fallback:<SceneBoundary fallback={fallback}><Scene plan={plan} tags={siteTags} machines={mapMachines} selectedMachine={selectedMachine?.machine.id||null} onSelectMachine={selectMachine} selected={zone?.id||null} placing={placing} camera={camera} onSelect={select} onOpenTag={onOpenTag} onUnavailable={unavailableHandler}/></SceneBoundary>:<VectorPlan plan={plan} tags={siteTags} machines={mapMachines} selectedMachine={selectedMachine?.machine.id||null} onSelectMachine={selectMachine} selected={zone?.id||null} placing={placing} onSelect={select} onOpenTag={onOpenTag}/>}</div>
    {selectedMachine&&!placing&&<div className="facility-selected-bar"><div><small>MACHINE SÉLECTIONNÉE</small><strong>{selectedMachine.machine.name}</strong></div><button disabled={!canEdit} onClick={()=>onAudit(selectedMachine)}><CalendarCheck size={15}/>Planifier l’audit</button></div>}
    <div className="facility-stage-bottom"><span>{mode==='3d'?'Cliquer : sélectionner · Glisser : tourner':'Cliquez sur une machine numérotée'}</span><div className="facility-camera">
     {mode==='3d'&&<><button aria-label="Vue du dessus de l’usine" aria-pressed={camera.top} onClick={()=>setCamera({...camera,top:!camera.top})}><Layers size={16}/></button><button aria-label="Réduire la maquette" disabled={camera.zoom<=.6} onClick={()=>setCamera({...camera,zoom:Math.max(.6,camera.zoom-.2)})}><Minus size={16}/></button><button aria-label="Agrandir la maquette" disabled={camera.zoom>=2} onClick={()=>setCamera({...camera,zoom:Math.min(2,camera.zoom+.2)})}><Plus size={16}/></button><button aria-label="Réinitialiser la vue de l’usine" onClick={reset}><RotateCcw size={15}/></button></>}
     <button aria-label={full?'Réduire l’explorateur':'Agrandir l’explorateur'} aria-pressed={full} onClick={()=>setFull(!full)}>{full?<X size={16}/>:<Maximize2 size={16}/>}</button>
    </div></div>
   </div><aside className="facility-sidebar" aria-label="Machines et audits 5S">
    <div className="facility-list-tabs"><button aria-pressed={listMode==='machines'} onClick={()=>setListMode('machines')}>Machines <span>{mapMachines.length}</span></button><button aria-pressed={listMode==='zones'} onClick={()=>setListMode('zones')}>Zones <span>{layout.zones.length}</span></button></div>
    {listMode==='machines'?<div className="facility-machine-list">{mapMachines.map(item=><button key={item.machine.id} aria-pressed={machineId===item.machine.id} onClick={()=>selectMachine(item)}><span className="facility-machine-index">{item.label}</span><span>{item.machine.name}<small>{item.zone.short}</small></span><ChevronRight size={13}/></button>)}</div>:<div className="facility-zone-list">{layout.zones.map((item,index)=>{const count=tagsInZone(siteTags,plan,item).filter(tag=>tag.status!=='Clôturée').length;return <button key={item.id} type="button" className={zone?.id===item.id?'selected':''} aria-pressed={zone?.id===item.id} onClick={()=>select(item,zoneCenter(item))}><span className="facility-zone-number" style={{color:zoneColors[item.category]}}>{String(index+1).padStart(2,'0')}</span><span>{item.short}<small>{zoneCategories[item.category]}</small></span>{count>0?<b>{count}</b>:<ChevronRight size={13}/>}</button>;})}</div>}
    {selectedMachine?<div className="facility-zone-detail facility-machine-detail" aria-live="polite"><span className="facility-detail-kicker">MACHINE SÉLECTIONNÉE</span><h3>{selectedMachine.machine.name}</h3><p>{selectedMachine.zone.name}</p><button className="facility-create facility-audit-create" disabled={!canEdit||placing} onClick={()=>onAudit(selectedMachine)}><CalendarCheck size={17}/>Planifier un audit 5S</button><button className="facility-machine-tag" disabled={!canEdit||placing} onClick={()=>onMachineTag(selectedMachine)}><Tag size={14}/>Ajouter une étiquette</button><div className="facility-machine-audits"><small>{machineAudits.length? 'Audits de cette machine':'Aucun audit planifié pour cette machine.'}</small>{machineAudits.map(audit=><button key={audit.id} disabled={placing} onClick={()=>onOpenAudit(audit)}><CalendarCheck size={15}/><span>{new Date(audit.scheduled_date+'T12:00:00').toLocaleDateString('fr-FR')}{audit.scheduled_time?' · '+audit.scheduled_time:''}<small>{audit.owner} · {audit.status}{auditScore(audit)!==null?' · '+auditScore(audit)+' %':''}</small></span><ArrowRight size={13}/></button>)}</div></div>:zone?<div className="facility-zone-detail"><span className="facility-detail-kicker">ZONE SÉLECTIONNÉE</span><h3>{zone.name}</h3><p>{zone.description}</p><div className="facility-focus"><Tag size={15}/><span>{zone.focus}</span></div><button className="facility-create" disabled={!canEdit||placing} onClick={()=>onCreate(plan,zone)}><Plus size={16}/>Étiqueter dans cette zone</button><div className="facility-zone-tags"><small>{zoneTags.length} étiquette{zoneTags.length!==1?'s':''} dans cette zone</small>{zoneTags.map(tag=><button key={tag.id} disabled={placing} onClick={()=>onOpenTag(tag)}><i style={{background:tagColors[tag.color]}}/><span>{tag.title}<small>{tag.status}</small></span><ArrowRight size={13}/></button>)}</div></div>:<div className="facility-zone-hint"><MapPin size={24}/><h3>La machine d’abord.</h3><p>Cliquez sur une machine numérotée dans la carte ou dans la liste. Sa référence apparaît ici avec le bouton pour planifier l’audit.</p><small>La sélection est conservée entre la vue 3D et le plan 2D.</small></div>}
   </aside></div>
   <footer className="facility-legend"><div>{Object.entries(zoneCategories).map(([id,label])=><span key={id}><i style={{background:zoneColors[id as keyof typeof zoneColors]}}/>{label}</span>)}</div><span>Références réelles · Emplacements schématiques à confirmer sur le terrain</span></footer>
  </div>
  <div className="facility-context"><p><strong>Du plan au terrain.</strong> Les machines numérotées sont liées aux références de l’inventaire. Leur disposition est schématique ; l’emplacement physique reste à confirmer. Les zones suivent les plans MYC, et la même sélection fonctionne en 2D et en 3D.</p><details className="facility-sources" onToggle={event=>setSourcesOpen(event.currentTarget.open)}><summary>Consulter les plans d’origine<ChevronRight size={14}/></summary>{sourcesOpen&&<div>{fiveSPlans.map(item=><article key={item.id}><header><h3>{item.name}</h3><a href={'/api/five-s/plans?plan='+item.id+'&format=pdf'} download><FileDown size={14}/>PDF original</a></header><div className={'five-s-plan-surface '+(placing?'placing':'')} onClick={event=>{
   if(!placing||!canEdit)return;const b=event.currentTarget.getBoundingClientRect(),point={x:(event.clientX-b.left)/b.width*100,y:(event.clientY-b.top)/b.height*100};onPlace(item.id,point,zoneAt(item.id,point));
  }}><Image src={'/api/five-s/plans?plan='+item.id} alt={'Document source MYC — '+item.name} width={3000} height={2121} unoptimized loading="lazy"/>{tags.filter(tag=>tag.plan_id===item.id&&tag.position).map(tag=><button key={tag.id} type="button" className={'five-s-pin '+tag.color} style={{left:tag.position!.x+'%',top:tag.position!.y+'%'}} aria-label={fiveSCode(tag)+' · '+tag.title} onClick={event=>{event.stopPropagation();if(!placing)onOpenTag(tag);}}><Tag size={14}/></button>)}</div></article>)}</div>}</details></div>
 </section>;
}
