import type {Workshop} from './workshop';
import type {Metrics} from './domain';

type Cells=Record<string,string|number>;
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const defectColumns:Record<string,string>={'dorure a chaud':'X','impression':'Y','rayure':'Z','rayures':'Z','manque de matiere':'AA','manque matiere':'AA','deformation':'AB','particules':'AC','piqures':'AD','oxydation':'AE','particules assemblage':'AG','ecrasement':'AH','rayures assemblage':'AI','rayure assemblage':'AI','reglage machine':'AJ','cassure':'AK','rupture':'AK','couple':'AL','couple de serrage':'AL','oxydation assemblage':'AM','impression assemblage':'AN','fibres de coton':'AO','embout floque':'AO','decalage':'AP','points noirs':'AQ','ecart de hauteur':'AR','denivele':'AR'};
const injectionStops:Record<string,string>={'anomalie moule':'S','anomalie du moule':'S','panne machine':'T','panne':'T','anomalie equipement':'T','anomalie de l equipement':'T','reglage produit':'U','anomalie produit':'U','changement de moule':'V','reglage machine':'V','validation premiere piece':'W','premiere piece':'W','essai moule':'X','essai de moule':'X','attente matiere':'Y','matiere':'Y','main d oeuvre':'Z','attente de main d oeuvre':'Z','sans of':'AA'};
const assemblyStops:Record<string,string>={'panne':'BD','panne machine':'BD','reparation panne':'BD','reparation de pannes':'BD','changement de serie':'BE','changement de ligne':'BE','approvisionnement':'BF','matiere entrante':'BF','attente matiere':'BF'};
const metalStops:Record<string,string>={'reglage':'AE','reglage anormal':'AE','panne':'AG','panne machine':'AG','changement de ligne':'AI','matiere entrante':'AK','attente matiere':'AK','echantillonnage':'AM','retravail':'AO'};
export function recordedMinutes(w:Workshop){
 if(w.entryMode==='totals')return w.totals?.plannedMinutes??0;
 return w.hours.filter(hour=>[hour.good,hour.rejects,hour.people,hour.plannedMinutes,hour.stopMinutes].some(value=>value!==null)).length*60;
}
export function hourlyOfficialCells(department:string,machine:string,reference:string,date:string,shift:string,w:Workshop,m:Metrics,machineName=''):Cells{
 const cells:Cells={},has=(key:'good'|'rejects'|'plannedMinutes'|'stopMinutes')=>w.entryMode==='totals'?w.totals?.[key]!=null:w.hours.some(hour=>hour[key]!==null);
 const number=(key:'good'|'rejects'|'plannedMinutes'|'stopMinutes',value:number)=>has(key)?value:'';
 const staff=w.entryMode==='totals'?[]:w.hours.filter(hour=>hour.people!==null);
 const weighted=staff.reduce((total,hour)=>total+(hour.people??0)*(hour.plannedMinutes??0),0);
 const actualLabor=w.laborCalculation==='standard-output'?m.laborMinutes!==null?m.laborMinutes/60:null:w.allocatedLaborHours;
 const people=actualLabor!==null&&m.loadMinutes>0?actualLabor*60/m.loadMinutes:w.entryMode==='totals'?(w.totals?.people??''):staff.length&&m.loadMinutes>0&&w.hours.filter(hour=>hour.plannedMinutes!==null&&hour.plannedMinutes>0).every(hour=>hour.people!==null)?weighted/m.loadMinutes:staff.length?Math.max(...staff.map(hour=>hour.people!)):'';
 const engaged=recordedMinutes(w),load=m.loadMinutes,stop=m.loadMinutes-m.runMinutes;
 const quality=m.actual+m.defects>0?m.actual/(m.actual+m.defects):null;
 const availability=load>0?m.runMinutes/load:null;
 const performance=m.idealSeconds!==null&&m.runMinutes>0?(m.actual+m.defects)*m.idealSeconds/(m.runMinutes*60):null;
 const dle=m.earnedMinutes!==null&&m.laborMinutes!==null&&m.laborMinutes>0?m.earnedMinutes/m.laborMinutes:null;
 const earned=w.laborCalculation==='standard-output'?m.earnedMinutes!==null?m.earnedMinutes/60:null:w.requiredLaborHours;
 const planning=w.plannedQuantity!==null&&w.plannedQuantity>0?m.actual/w.plannedQuantity:null;
 const standard=m.idealSeconds!==null&&m.idealSeconds>0?m.runMinutes*60/m.idealSeconds:null;
 const details=[w.notes,...(w.stops.length?['Arrêts : '+w.stops.map(item=>item.cause+' ('+item.minutes+' min)').join('; ')]:[]),...(w.defects.length?['Défauts : '+w.defects.map(item=>item.cause+' ('+item.quantity+' pcs)').join('; ')]:[])].filter(Boolean).join('\n').slice(0,4000);
 if(department==='injection'){
  for(const key of ['S','T','U','V','W','X','Y','Z','AA'])cells[key]=0;
  for(const item of w.stops){const key=injectionStops[normalize(item.cause)];if(key)cells[key]=Number(cells[key])+item.minutes;}
  return {...cells,A:machine,C:shift,E:reference,AD:w.idealCycleSeconds??'',AE:has('good')&&m.actual+m.defects>0?m.runMinutes*60*w.cavities/(m.actual+m.defects):'',AF:w.cavities,AG:w.cavities,AI:people,AJ:number('good',m.actual),AN:number('plannedMinutes',m.runMinutes/60),AO:number('stopMinutes',stop/60),AQ:w.defects.map(item=>item.cause).join('; ').slice(0,4000),AR:number('rejects',m.defects),BD:details};
 }
 if(department==='metalisation'){
  for(const key of ['AE','AG','AI','AK','AM','AO'])cells[key]=0;
  for(const item of w.stops){const key=metalStops[normalize(item.cause)];if(key)cells[key]=Number(cells[key])+item.minutes/60;}
  const incoming=w.defects.filter(item=>['matiere entrante','defaut matiere entrante','defauts matiere entrante'].includes(normalize(item.cause))).reduce((sum,item)=>sum+item.quantity,0);
  return {...cells,A:date,B:machine,C:shift,H:reference,L:w.plannedQuantity??'',M:people,N:number('good',m.actual),O:has('rejects')?incoming:'',P:has('rejects')?Math.max(0,m.defects-incoming):'',Q:number('rejects',m.defects),AB:has('plannedMinutes')?engaged/60:'',AC:number('plannedMinutes',load/60),AP:number('stopMinutes',stop/60),AQ:number('plannedMinutes',m.runMinutes/60),AR:availability===null?'':availability*100,AS:performance===null?'':performance*100,AT:quality===null?'':quality*100,AU:m.oeeRatio===null?'':m.oeeRatio!*100,AV:details,...(standard!==null?{K:standard}:{})};
 }
 const defectKeys=['X','Y','Z','AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ','AR','AS'];
 for(const key of defectKeys)cells[key]=0;
 for(const item of w.defects){const key=defectColumns[normalize(item.cause)]||'AS';cells[key]=Number(cells[key])+item.quantity;}
 cells.AS=Number(cells.AS)+Math.max(0,m.defects-w.defects.reduce((sum,item)=>sum+item.quantity,0));
 for(const key of ['BD','BE','BF','BG'])cells[key]=0;
 for(const item of w.stops){const key=assemblyStops[normalize(item.cause)]||'BG';cells[key]=Number(cells[key])+item.minutes;}
 cells.BG=Number(cells.BG)+Math.max(0,stop-w.stops.reduce((sum,item)=>sum+item.minutes,0));
 return {...cells,A:date,B:shift,C:machine,D:machineName,F:reference,O:w.plannedQuantity??'',P:number('good',m.actual),S:people,T:number('plannedMinutes',load/60),U:number('stopMinutes',stop),V:earned!==null&&m.actual>0?earned*60/m.actual:'',W:earned!==null?earned*60:'',AT:number('rejects',m.defects),AU:has('plannedMinutes')?engaged:'',BA:has('plannedMinutes')?Math.max(0,engaged-load):'',BB:number('plannedMinutes',load),BC:number('plannedMinutes',load/60),BH:number('stopMinutes',stop),BI:number('plannedMinutes',m.runMinutes),BJ:planning??'',BK:dle??'',BL:engaged>0?load/engaged:'',BM:engaged>0&&m.oeeRatio!==null?load/engaged*m.oeeRatio!:'',BN:availability??'',BO:performance??'',BP:quality??'',BQ:m.oeeRatio??'',BR:details,...(standard!==null?{N:standard}:{})};
}
