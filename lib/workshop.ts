import {z} from 'zod';
import {hourlyOfficialCells} from './excel-fields';
import type {Metrics,Report} from './domain';
import {shifts,shiftSlots,shiftDefinition,sameShift,canonicalSlot,slotStart} from './shifts';

export const timeSlots=shiftSlots();
const positive=z.number().finite().min(0).max(100000000);
const totalsSchema=z.object({good:positive.nullable(),rejects:positive.nullable(),people:positive.nullable(),plannedMinutes:positive.max(1440).nullable(),stopMinutes:positive.max(1440).nullable()});
export const workshopSchema=z.object({
 productId:z.string().max(100).optional(),productName:z.string().max(180).optional(),productOperation:z.string().max(80).optional(),
 laborCalculation:z.enum(['standard-output']).optional(),standardLaborSeconds:positive.nullable().optional(),
 oeeTarget:positive.max(100).nullable().optional(),dleTarget:positive.max(100).nullable().optional(),
 entryMode:z.enum(['hourly','totals']).optional(),totals:totalsSchema.optional(),
 hours:z.array(z.object({slot:z.string().max(20),good:positive.nullable(),rejects:positive.nullable(),people:positive.nullable(),plannedMinutes:positive.max(60).nullable(),stopMinutes:positive.max(60).nullable()})).min(1).max(24),
 plannedQuantity:positive.nullable(),idealCycleSeconds:positive.nullable(),cavities:positive.min(1),allocatedLaborHours:positive.nullable(),requiredLaborHours:positive.nullable(),
 defects:z.array(z.object({cause:z.string().trim().max(150),quantity:positive})).max(50),
 stops:z.array(z.object({cause:z.string().trim().max(150),minutes:positive})).max(50),notes:z.string().max(4000)
});
export type Workshop=z.infer<typeof workshopSchema>;
export function workshopTotals(w:Workshop){
 if(w.entryMode==='totals')return w.totals??{good:null,rejects:null,people:null,plannedMinutes:null,stopMinutes:null};
 const sum=(key:'good'|'rejects'|'plannedMinutes'|'stopMinutes')=>{const values=w.hours.map(h=>h[key]).filter((v):v is number=>v!==null);return values.length?values.reduce((a,b)=>a+b,0):null;};
 const people=w.hours.map(h=>h.people).filter((v):v is number=>v!==null);
 return {good:sum('good'),rejects:sum('rejects'),people:people.length?Math.max(...people):null,plannedMinutes:sum('plannedMinutes'),stopMinutes:sum('stopMinutes')};
}
export const newWorkshop=(shift=shifts[0].value):Workshop=>({hours:shiftSlots(shift).map(slot=>({slot,good:null,rejects:null,people:null,plannedMinutes:null,stopMinutes:null})),plannedQuantity:null,idealCycleSeconds:null,cavities:1,allocatedLaborHours:null,requiredLaborHours:null,defects:[],stops:[],notes:''});
export function workshopLabor(w:Workshop){
 if(w.laborCalculation!=='standard-output')return {earnedHours:w.allocatedLaborHours,spentHours:w.requiredLaborHours};
 const totals=workshopTotals(w);
 const earnedHours=totals.good!==null&&w.standardLaborSeconds!=null&&w.standardLaborSeconds>0?totals.good*w.standardLaborSeconds/3600:null;
 const staffed=w.hours.filter(hour=>hour.plannedMinutes!==null&&hour.plannedMinutes>0);
 const spentHours=w.entryMode==='totals'?(totals.people!==null&&totals.plannedMinutes!==null?totals.people*totals.plannedMinutes/60:null):staffed.length&&staffed.every(hour=>hour.people!==null)?staffed.reduce((sum,hour)=>sum+hour.people!*hour.plannedMinutes!/60,0):null;
 return {earnedHours,spentHours};
}
export function workshopMetrics(w:Workshop):Metrics{
 const totals=workshopTotals(w);
 const sum=(key:'good'|'rejects'|'plannedMinutes'|'stopMinutes')=>totals[key]??0;
 const good=sum('good'),rejects=sum('rejects'),load=sum('plannedMinutes'),stop=sum('stopMinutes'),run=load-stop,total=good+rejects;
 const availability=load>0?run/load:null;
 const ideal=w.idealCycleSeconds!==null&&w.idealCycleSeconds>0?w.idealCycleSeconds/w.cavities:null;
 const performance=ideal!==null&&run>0?total*ideal/(run*60):null;
 const quality=total>0?good/total:null;
 const losses:Record<string,number>={},defectCategories:Record<string,number>={};
 for(const s of w.stops)if(s.cause)losses[s.cause]=(losses[s.cause]||0)+s.minutes;
 for(const d of w.defects)if(d.cause)defectCategories[d.cause]=(defectCategories[d.cause]||0)+d.quantity;
 const labor=workshopLabor(w);
 return {planned:w.plannedQuantity??0,actual:good,defects:rejects,loadMinutes:load,runMinutes:run,idealSeconds:ideal,oeeRatio:availability!==null&&performance!==null&&quality!==null?availability*performance*quality:null,earnedMinutes:labor.earnedHours!==null?labor.earnedHours*60:null,laborMinutes:labor.spentHours!==null?labor.spentHours*60:null,losses,defectCategories};
}
export function validateWorkshop(w:Workshop){
 const active=w.entryMode==='totals'?[{slot:'Total de l’équipe',...workshopTotals(w)}]:w.hours.filter(h=>h.good!==null||h.rejects!==null||h.plannedMinutes!==null||h.stopMinutes!==null);
 if(!active.length)throw new Error('Renseignez au moins une heure de production.');
 if(w.laborCalculation==='standard-output'&&active.some(hour=>(hour.good!==null&&!Number.isInteger(hour.good))||(hour.rejects!==null&&!Number.isInteger(hour.rejects))))throw new Error('Les pièces conformes et les rebuts doivent être des nombres entiers.');
 for(const h of active){if(h.good===null||h.rejects===null||h.plannedMinutes===null)throw new Error(`${h.slot} : renseignez production, rebuts et minutes planifiées (0 est accepté).`);if((h.stopMinutes??0)>h.plannedMinutes)throw new Error(`${h.slot} : les arrêts dépassent le temps planifié.`);}
 const totals=workshopTotals(w),rejects=totals.rejects??0,stops=totals.stopMinutes??0;
 if(w.defects.reduce((n,d)=>n+d.quantity,0)>rejects)throw new Error('Les défauts détaillés dépassent le total des rebuts.');
 if(w.stops.reduce((n,d)=>n+d.minutes,0)>stops)throw new Error('Les causes d’arrêt détaillées dépassent le total des arrêts.');
}
export function workshopSummary(reports:Report[]){
 const rows=reports.filter(r=>r.status==='validated');const sum=(key:'actual'|'defects'|'planned'|'loadMinutes'|'runMinutes')=>rows.reduce((n,r)=>n+r.metrics[key],0);
 const actual=sum('actual'),defects=sum('defects'),planned=sum('planned');
 const oeeRows=rows.filter(r=>r.metrics.actual+r.metrics.defects>0),total=oeeRows.reduce((n,r)=>n+r.metrics.actual+r.metrics.defects,0);
 const completeOee=oeeRows.length>0&&oeeRows.every(r=>r.workshop&&r.metrics.oeeRatio!==null&&r.metrics.oeeRatio!==undefined);
 const completeDle=rows.length>0&&rows.every(r=>r.workshop&&r.metrics.earnedMinutes!==null&&r.metrics.laborMinutes!==null&&r.metrics.laborMinutes>0);
 const mixedLaborRules=new Set(rows.map(r=>r.workshop?.laborCalculation||'legacy')).size>1;
 const allocated=rows.reduce((n,r)=>n+(r.metrics.earnedMinutes??0),0),required=rows.reduce((n,r)=>n+(r.metrics.laborMinutes??0),0);
 return {count:rows.length,actual,defects,planned,load:sum('loadMinutes'),run:sum('runMinutes'),oee:completeOee?oeeRows.reduce((n,r)=>n+r.metrics.oeeRatio!*(r.metrics.actual+r.metrics.defects),0)/total*100:null,dle:completeDle&&!mixedLaborRules&&required>0?allocated/required*100:null,mixedLaborRules,planning:planned>0?actual/planned*100:null,quality:actual+defects>0?actual/(actual+defects)*100:null,allocated:allocated/60,required:required/60};
}
export function toOfficialCells(department:string,machine:string,reference:string,date:string,shift:string,w:Workshop,machineName=''):Record<string,string|number>{
 return hourlyOfficialCells(department,machine,reference,date,shift,w,workshopMetrics(w),machineName);
}

export function workshopForShift(existing:Workshop|undefined,shift:string):Workshop{
 if(!existing)return newWorkshop(shift);
 const target=shiftSlots(shift),allowed=new Set(target);
 const populatedOutside=existing.hours.some(hour=>!allowed.has(canonicalSlot(hour.slot))&&['good','rejects','people','plannedMinutes','stopMinutes'].some(key=>hour[key as keyof typeof hour]!==null));
 if(populatedOutside)return {...existing,hours:existing.hours.map(hour=>({...hour,slot:canonicalSlot(hour.slot)}))};
 const bySlot=new Map(existing.hours.map(hour=>[canonicalSlot(hour.slot),hour]));
 return {...existing,hours:target.map(slot=>bySlot.has(slot)?{...bySlot.get(slot)!,slot}:{slot,good:null,rejects:null,people:null,plannedMinutes:null,stopMinutes:null})};
}
export function aggregateHourlyReports(reports:Report[],selectedShift='all'){
 const hourlyReports=reports.filter(report=>report.workshop?.entryMode!=='totals');
 const selected=selectedShift==='all'?hourlyReports:hourlyReports.filter(report=>sameShift(report.shift,selectedShift));
 const baseline=selectedShift==='all'?shifts.flatMap(shift=>shift.slots):shiftSlots(selectedShift);
 const slots=[...new Set([...baseline,...selected.flatMap(report=>report.workshop?.hours.map(hour=>canonicalSlot(hour.slot))||[])])];
 const anchor=selectedShift==='all'?360:shiftDefinition(selectedShift)?.start??360;
 slots.sort((a,b)=>((slotStart(a)??anchor)+1440-anchor)%1440-((slotStart(b)??anchor)+1440-anchor)%1440||a.localeCompare(b));
 return slots.map(slot=>{
  const matching=selected.flatMap(report=>report.workshop?.hours.filter(hour=>canonicalSlot(hour.slot)===slot)||[]);
  const sum=(key:'good'|'rejects'|'people'|'plannedMinutes'|'stopMinutes')=>{const values=matching.map(hour=>hour[key]).filter((value):value is number=>value!==null);return values.length?values.reduce((a,b)=>a+b,0):null;};
  const planned=sum('plannedMinutes');
  return {slot,good:sum('good'),rejects:sum('rejects'),people:sum('people'),planned:planned===null?null:planned/60,stop:sum('stopMinutes')};
 });
}
