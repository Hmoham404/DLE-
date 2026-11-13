import type {Machine,Report} from './domain';
import {workshopLabor,workshopMetrics,toOfficialCells} from './workshop';
import {recordedMinutes} from './excel-fields';
import {shiftDefinition} from './shifts';

export const orderColumn=(department:string)=>department==='injection'?'H':department==='metalisation'?'D':'L';
const cumulativeColumn=(department:string)=>department==='injection'?'AK':department==='metalisation'?'R':'Q';
function orderKey(report:Report){return String(report.cells[orderColumn(report.department)]||report.reference).trim();}
function beforeOrSame(a:Report,b:Report){return a.date<b.date||(a.date===b.date&&(shiftDefinition(a.shift)?.start??0)<=(shiftDefinition(b.shift)?.start??0));}
export function automaticCells(report:Report,machine?:Machine,allReports:Report[]=[]){
 if(!report.workshop)return {};
 const w=report.workshop,m=workshopMetrics(w);
 const code=machine?.inventory?.code||machine?.name||String(report.cells[report.department==='injection'?'A':report.department==='metalisation'?'B':'C']||'');
 const name=machine?.inventory?.category||machine?.line||machine?.name||'';
 const cells=toOfficialCells(report.department,code,report.reference,report.date,report.shift,w,name);
 const candidates=new Map(allReports.filter(item=>item.status==='validated'&&item.department===report.department&&orderKey(item)===orderKey(report)&&beforeOrSame(item,report)).map(item=>[item.id,item]));
 candidates.set(report.id,{...report,metrics:m});
 const values=[...candidates.values()];
 cells[cumulativeColumn(report.department)]=values.reduce((sum,item)=>sum+item.metrics.actual,0);
 if(report.department==='injection'){
  cells.AS=values.reduce((sum,item)=>sum+item.metrics.defects,0);
  const actualHours=values.map(item=>item.workshop?item.workshop.laborCalculation==='standard-output'?workshopLabor(item.workshop).spentHours:item.workshop.allocatedLaborHours:null);
  cells.AP=actualHours.every(value=>value!==null)?actualHours.reduce<number>((sum,value)=>sum+(value??0),0):'';
 }
 return cells;
}
export function prepareReportForExcel(report:Report,machine?:Machine,allReports:Report[]=[]):Report{
 return report.workshop?{...report,metrics:workshopMetrics(report.workshop),cells:{...report.cells,...automaticCells(report,machine,allReports)}}:report;
}
export function automaticFormulas(report:Report,row:number):Record<string,string|null>{
 if(!report.workshop)return {};
 const w=report.workshop,m=workshopMetrics(w),c=report.cells,engaged=recordedMinutes(w);
 const standardLabor=w.laborCalculation==='standard-output',labor=workshopLabor(w);
 const hasLabor=m.earnedMinutes!==null&&m.laborMinutes!==null&&m.laborMinutes>0;
 const numeric=(value:string|number|undefined)=>value!==undefined&&value!==''&&Number.isFinite(Number(value))?String(Number(value)):null;
 const safe=(expression:string)=>'IFERROR('+expression+',"")';
 if(report.department==='injection'){
  const classified=['S','T','U','V','W','X','Y','Z','AA'].reduce((sum,key)=>sum+Number(c[key]||0),0);
  return {J:String(engaged),Q:String(Math.max(0,engaged-m.loadMinutes)),R:String(m.loadMinutes),AB:'SUM(S'+row+':AA'+row+')+'+Math.max(0,m.loadMinutes-m.runMinutes-classified),AC:'R'+row+'-AB'+row,AH:safe('AC'+row+'*60/AD'+row+'*AF'+row),AM:'R'+row+'/60',AL:numeric((standardLabor?labor.earnedHours:w.requiredLaborHours)??undefined),AW:hasLabor?safe(standardLabor?'AL'+row+'/(AM'+row+'*AI'+row+')':'(AM'+row+'*AI'+row+')/AL'+row):null,BA:safe('(AJ'+row+'+AR'+row+')/AH'+row),AT:safe('AJ'+row+'/AH'+row),AV:safe('AS'+row+'/(AK'+row+'+AS'+row+')'),AX:safe('R'+row+'/J'+row),AY:m.oeeRatio!==null?safe('AX'+row+'*BC'+row):null,AZ:safe('AC'+row+'/R'+row),BB:safe('AJ'+row+'/(AJ'+row+'+AR'+row+')'),BC:m.oeeRatio!==null?safe('AZ'+row+'*BA'+row+'*BB'+row):null,AK:numeric(c.AK)!==null?'AJ'+row+'+'+Math.max(0,Number(c.AK)-m.actual):null,AS:numeric(c.AS)!==null?'AR'+row+'+'+Math.max(0,Number(c.AS)-m.defects):null,AP:numeric(c.AP)};
 }
 if(report.department==='assemblage'){
  return {O:numeric(c.O),U:numeric(c.U),V:numeric(c.V),W:numeric(c.W),AU:String(engaged),BA:String(Math.max(0,engaged-m.loadMinutes)),BB:String(m.loadMinutes),BC:'BB'+row+'/60',BH:'SUM(BD'+row+':BG'+row+')',BI:'BB'+row+'-BH'+row,BL:safe('BB'+row+'/AU'+row),BM:m.oeeRatio!==null?safe('BL'+row+'*BQ'+row):null,BJ:safe('P'+row+'/O'+row),BN:safe('BI'+row+'/BB'+row),BO:m.idealSeconds!==null?safe('(P'+row+'+AT'+row+')/N'+row):null,BP:safe('P'+row+'/(P'+row+'+AT'+row+')'),BQ:m.oeeRatio!==null?safe('BN'+row+'*BO'+row+'*BP'+row):null,BK:hasLabor?safe(standardLabor?'W'+row+'/(T'+row+'*60*S'+row+')':'(T'+row+'*60*S'+row+')/W'+row):null};
 }
 return {};
}
