'use client';
import {useEffect,useState} from 'react';
import {Plus} from 'lucide-react';
import type {Machine} from '@/lib/domain';
import {isProductionUnit,lineOptions,unitLabel} from '@/lib/equipment';

export function EntryEquipment({machines,department,machineId,onSelect,onManage,onContextChange}:{machines:Machine[];department:string;machineId:string;onSelect:(id:string)=>void;onManage:()=>void;onContextChange:(change:()=>void)=>void}){
 const [line,setLine]=useState('all');
 const active=machines.find(m=>m.id===machineId);
 useEffect(()=>setLine('all'),[department]);
 useEffect(()=>{if(line!=='all'&&active?.line!==line)setLine('all');},[machineId]);
 const all=machines.filter(m=>m.department===department&&isProductionUnit(m));
 const options=all.filter(m=>line==='all'||m.line===line);
 const lines=lineOptions(machines,department);
 return <>{lines.length>0&&<label>Ligne<select value={line} onChange={e=>{const next=e.target.value;onContextChange(()=>{setLine(next);const candidates=all.filter(m=>next==='all'||m.line===next);onSelect((candidates.find(m=>m.assetKind==='line')||candidates[0])?.id||'');});}}><option value="all">Toutes les lignes</option>{lines.map(name=><option key={name}>{name}</option>)}</select></label>}<label>Machine / ligne de saisie<select value={machineId} onChange={e=>onContextChange(()=>onSelect(e.target.value))}><option value="">Sélectionner une machine ou une ligne</option>{options.some(m=>m.assetKind==='line')&&<optgroup label="Saisie globale par ligne">{options.filter(m=>m.assetKind==='line').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}<optgroup label="Saisie par machine">{options.filter(m=>m.assetKind!=='line').map(m=><option key={m.id} value={m.id}>{unitLabel(m)}{m.line?' · '+m.line:''}</option>)}</optgroup></select></label><button className="filter-add" onClick={onManage} title="Machines, matricules et lignes"><Plus size={19}/><span>Gérer</span></button></>;
}
