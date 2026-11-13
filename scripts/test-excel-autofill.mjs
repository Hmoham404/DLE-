import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({stdin:{contents:"export * from './lib/excel-autofill';export * from './lib/workshop';export * from './lib/excel';export * from './lib/cell-calculation';export * from './lib/shifts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/excel-auto.mjs',tsconfig:'tsconfig.json'});
const api=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/excel-auto.mjs'));
const templates=JSON.parse(await readFile('data/templates.json','utf8'));
let passed=0;
const test=(name,run)=>{run();passed++;console.log('PASS '+name);};
const close=(a,b)=>assert.ok(typeof a==='number'&&Math.abs(a-b)<1e-8,String(a)+' != '+b);
export function fixture(department,shift=api.shifts[3].value){
 const w=api.newWorkshop(shift);
 Object.assign(w,{plannedQuantity:120,idealCycleSeconds:10,cavities:2,allocatedLaborHours:w.hours.length*2,requiredLaborHours:15,defects:[{cause:'Rayures',quantity:3},{cause:'Points noirs',quantity:2},{cause:'Autre cause',quantity:1}],stops:[{cause:'Panne machine',minutes:10},{cause:'Changement de ligne',minutes:15},{cause:'Autre cause',minutes:15}],notes:'Note de production <&>'});
 w.hours=w.hours.map(h=>({...h,good:10,rejects:1,people:2,plannedMinutes:60,stopMinutes:5}));
 const machine={id:crypto.randomUUID(),department,name:'Nom machine',line:'Ligne test',inventory:{code:'MYC-TEST-001',category:'Equipement test'}};
 const report={id:crypto.randomUUID(),date:'2099-03-01',department,shift,machine_id:machine.id,reference:'PRODUIT-1',status:'validated',workshop:w,cells:{[api.orderColumn(department)]:'77',G:'Description conservee'},metrics:api.workshopMetrics(w)};
 return {w,machine,report};
}
export function cell(xml,address){
 const c=xml.match(new RegExp('<c\\b[^>]*\\br="'+address+'"[^>]*?(?:/>|>[\\s\\S]*?</c>)'))?.[0]||'';
 const v=c.match(/<v[^>]*>([^<]*)<\/v>/)?.[1];
 return {xml:c,value:v===undefined?null:Number(v),formula:c.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1]};
}
for(const department of Object.keys(templates)){
 const {w,machine,report}=fixture(department),t=templates[department],m=api.workshopMetrics(w);
 const prepared=api.prepareReportForExcel(report,machine,[report]),c=prepared.cells;
 const actual=department==='injection'?'AJ':department==='metalisation'?'N':'P',reject=department==='injection'?'AR':department==='metalisation'?'Q':'AT',oee=department==='injection'?'BC':department==='metalisation'?'AU':'BQ';
 test(department+': machine, reference, OF, quantities and complementary inputs',()=>{
  assert.equal(c[department==='injection'?'A':department==='metalisation'?'B':'C'],machine.inventory.code);
  assert.equal(c[department==='injection'?'E':department==='metalisation'?'H':'F'],report.reference);
  assert.equal(c[api.orderColumn(department)],'77');assert.equal(c[actual],100);assert.equal(c[reject],10);assert.equal(c.G,'Description conservee');
 });
 const original=unzipSync(api.sourceBytes(department)),output=unzipSync(api.exportWorkbook(department,[report],{machines:[machine],allReports:[report]})),xml=strFromU8(output[t.sheetPath]),before=strFromU8(original[t.sheetPath]);
 test(department+': template layout and all other ZIP members preserved',()=>{
  assert.deepEqual(Object.keys(output).sort(),Object.keys(original).sort());
  for(const name of Object.keys(original))if(![t.sheetPath,'xl/workbook.xml'].includes(name))assert.deepEqual(output[name],original[name],name);
  for(const tag of ['cols','mergeCells','sheetViews','sheetFormatPr','pageMargins','pageSetup','printOptions','headerFooter','conditionalFormatting','drawing']){
   const re=new RegExp('<'+tag+'\\b[^>]*(?:/>|>[\\s\\S]*?</'+tag+'>)','g');assert.deepEqual(xml.match(re),before.match(re),tag);
  }
 });
 test(department+': saved quantities and OEE match the hourly entry',()=>{
  assert.equal(cell(xml,actual+t.startRow).value,100);assert.equal(cell(xml,reject+t.startRow).value,10);
  close(cell(xml,oee+t.startRow).value,m.oeeRatio*(department==='metalisation'?100:1));
 });
 if(['injection','assemblage'].includes(department))test(department+': actual 10-hour shift and confirmed DLE formula',()=>{
  assert.equal(cell(xml,(department==='injection'?'J':'AU')+t.startRow).value,600);
  close(cell(xml,(department==='injection'?'AW':'BK')+t.startRow).value,20/15);
  if(department==='assemblage'){assert.equal(cell(xml,'O'+t.startRow).value,120);assert.equal(cell(xml,'W'+t.startRow).value,900);for(const key of ['E','M']){assert.equal(cell(xml,key+t.startRow).formula,undefined);assert.equal(cell(xml,key+t.startRow).value,null);}}
 });
 if(['serigraphie','assemblage'].includes(department))test(department+': every reject and stop remains counted, including unclassified causes',()=>{
  assert.equal(c.Z,3);assert.equal(c.AQ,2);assert.equal(c.AS,5);
  assert.equal(c.BD,10);assert.equal(c.BE,15);assert.equal(c.BG,25);
  assert.equal(cell(xml,'BH'+t.startRow).value,50);
 });
 test(department+': missing standard and labor data stay unavailable',()=>{
  const missing={...report,workshop:{...w,idealCycleSeconds:null,allocatedLaborHours:null,requiredLaborHours:null}};
  const p=api.prepareReportForExcel(missing,machine,[]),calc=api.calculateCells(department,p.cells,api.automaticFormulas(p,t.startRow));
  if(department==='injection'){assert.equal(calc.BC,null);assert.equal(calc.AW,null);}
  else if(department==='assemblage'){assert.equal(calc.BQ,null);assert.equal(calc.BK,null);}
  else {assert.equal(p.cells[oee],'');assert.equal(p.cells.BK??'', '');}
 });
}
test('8-hour shift exports 480 minutes and cloned row formulas refer to their own row',()=>{
 const {machine,report}=fixture('injection',api.shifts[0].value),t=templates.injection;
 const rows=[report,{...report,id:crypto.randomUUID()}];
 const xml=strFromU8(unzipSync(api.exportWorkbook('injection',rows,{machines:[machine],allReports:rows}))[t.sheetPath]);
 assert.equal(cell(xml,'J4').value,480);assert.equal(cell(xml,'J5').value,480);
 assert.equal(cell(xml,'AC5').formula,'R5-AB5');close(cell(xml,'BC5').value,report.metrics.oeeRatio);
});
test('cumulative values use validated matching OFs and exclude drafts and future reports',()=>{
 const {machine,report}=fixture('injection');
 const previous={...report,id:crypto.randomUUID(),date:'2099-02-28',metrics:{...report.metrics,actual:50,defects:2}};
 const wrong={...previous,id:crypto.randomUUID(),cells:{...previous.cells,H:'OTHER'}};
 const draft={...previous,id:crypto.randomUUID(),status:'draft'};
 const future={...previous,id:crypto.randomUUID(),date:'2099-03-02'};
 const p=api.prepareReportForExcel(report,machine,[previous,wrong,draft,future,report]);
 assert.equal(p.cells.AK,150);assert.equal(p.cells.AS,12);
 const calc=api.calculateCells('injection',p.cells,api.automaticFormulas(p,4));
 assert.equal(calc.AK,150);assert.equal(calc.AS,12);
});
test('legacy Excel import retains its inputs and original formulas',()=>{
 const {report}=fixture('assemblage');delete report.workshop;
 assert.equal(api.prepareReportForExcel(report),report);assert.deepEqual(api.automaticFormulas(report,2),{});
});
for(const department of Object.keys(templates))test(department+': manual shift totals export without hourly input',()=>{
 const {report,machine}=fixture(department);report.workshop={...report.workshop,entryMode:'totals',totals:{good:500,rejects:20,people:3,plannedMinutes:480,stopMinutes:40},hours:report.workshop.hours.map(h=>({...h,good:null,rejects:null,people:null,plannedMinutes:null,stopMinutes:null})),defects:[],stops:[],allocatedLaborHours:null};
 const prepared=api.prepareReportForExcel(report,machine,[report]),t=templates[department];
 assert.equal(prepared.metrics.actual,500);assert.equal(prepared.metrics.loadMinutes,480);assert.equal(prepared.metrics.runMinutes,440);
 const bytes=api.exportWorkbook(department,[report],{machines:[machine],allReports:[report]}),xml=strFromU8(unzipSync(bytes)[t.sheetPath]);
 assert.equal(cell(xml,(department==='injection'?'AJ':department==='metalisation'?'N':'P')+t.startRow).value,500);
 assert.equal(cell(xml,(department==='injection'?'AI':department==='metalisation'?'M':'S')+t.startRow).value,3);
 if(department==='injection'){assert.equal(cell(xml,'R'+t.startRow).value,480);assert.equal(cell(xml,'AB'+t.startRow).value,40);}
});
console.log(JSON.stringify({passed}));
