import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({stdin:{contents:"export * from './lib/product-standards';export * from './lib/workshop';export * from './lib/excel-autofill';export * from './lib/excel';export * from './lib/shifts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/production-entry.mjs',tsconfig:'tsconfig.json'});
const api=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/production-entry.mjs'));
const templates=JSON.parse(await readFile('data/templates.json','utf8'));
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const close=(actual,expected)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const report=work=>({id:crypto.randomUUID(),date:'2099-01-01',department:'injection',machine_id:crypto.randomUUID(),shift:api.shifts[0].value,reference:'2.1.30171',status:'validated',cells:{},workshop:work,metrics:api.workshopMetrics(work)});
test('rapid entry starts on shift totals with explicit zero rejects/stops and no invented staff or quantities',()=>{
 for(const shift of api.shifts){const work=api.quickWorkshop(shift.value);assert.equal(work.entryMode,'totals');assert.equal(work.totals.plannedMinutes,shift.hours*60);assert.equal(work.totals.good,null);assert.equal(work.totals.people,null);assert.equal(work.totals.rejects,0);assert.equal(work.totals.stopMinutes,0);assert.ok(work.hours.every(hour=>hour.good===null));}
});
test('every supplied reference passes server validation; fractional staffing and exact spreadsheet values survive',()=>{
 assert.equal(api.initialProductStandards.length,12);
 for(const product of api.initialProductStandards)assert.ok(api.productStandardSchema.safeParse(product).success,product.reference);
 const products=api.productStandards();assert.equal(api.findProduct(products,'serigraphie','2.4.30051').standardOperators,1.5);assert.equal(api.findProduct(products,'assemblage','3.3.30273').standardSeconds,42.35);assert.equal(api.findProduct(products,'metalisation','12900BD').cycleSeconds,1.036);
});
test('choosing an injection article uses the mold cycle once and never divides the per-piece cycle by cavities twice',()=>{
 const work=api.applyProductStandard(api.quickWorkshop(api.shifts[0].value),api.initialProductStandards[0]);assert.equal(work.idealCycleSeconds,39);assert.equal(work.cavities,8);assert.equal(api.workshopMetrics(work).idealSeconds,4.875);assert.equal(work.totals.people,null);
});
test('DLE uses good pieces times standard labor seconds divided by actual person-hours; stops do not remove presence time',()=>{
 const product=api.findProduct(api.initialProductStandards,'assemblage','3.3.30273');const work=api.applyProductStandard(api.quickWorkshop(api.shifts[0].value),product);work.totals.good=7200;work.totals.stopMinutes=60;
 api.validateWorkshop(work);const m=api.workshopMetrics(work);close(m.earnedMinutes,7200*42.35/60);assert.equal(m.laborMinutes,13*480);close(api.workshopSummary([report(work)]).dle,7200*42.35/(13*8*3600)*100);
});
test('unknown staff or standard time leaves DLE unavailable; zero output with real staffing is a valid zero DLE',()=>{
 const work=api.quickWorkshop(api.shifts[0].value);work.totals.good=0;work.standardLaborSeconds=10;api.validateWorkshop(work);assert.equal(api.workshopSummary([report(work)]).dle,null);work.totals.people=2;assert.equal(api.workshopSummary([report(work)]).dle,0);work.standardLaborSeconds=null;assert.equal(api.workshopSummary([report(work)]).dle,null);
});
test('changing quantities preserves product parameters and does not synthesize hourly production',()=>{
 const work=api.applyProductStandard(api.quickWorkshop(api.shifts[0].value),api.initialProductStandards[0]);work.totals.good=1000;const copy=api.workshopSchema.parse(JSON.parse(JSON.stringify(work)));assert.equal(copy.productId,work.productId);assert.equal(copy.standardLaborSeconds,4.875);assert.equal(copy.totals.good,1000);assert.ok(copy.hours.every(hour=>hour.good===null));const hourly=api.aggregateHourlyReports([report(copy)]);assert.ok(hourly.every(hour=>hour.good===null));
});
test('piece counts reject fractions while actual staffing can remain fractional',()=>{
 const work=api.quickWorkshop(api.shifts[0].value);work.totals.good=10.5;assert.throws(()=>api.validateWorkshop(work),/entiers/);work.totals.good=10;work.totals.people=1.5;api.validateWorkshop(work);
});
test('reference changes clear stale standards; saved report snapshots are independent from future catalog edits',()=>{
 const product={...api.initialProductStandards[0]};const work=api.applyProductStandard(api.quickWorkshop(api.shifts[0].value),product);product.standardSeconds=500;assert.equal(work.standardLaborSeconds,4.875);const cleared=api.clearProductStandard(work);assert.equal(cleared.idealCycleSeconds,null);assert.equal(cleared.standardLaborSeconds,null);assert.equal(cleared.productId,undefined);
});
test('persisted catalog changes override the supplied defaults without duplicating the same identity',()=>{
 const changed={...api.initialProductStandards[0],defaultPeople:2,standardSeconds:5};const products=api.productStandards([changed]);assert.equal(products.length,12);const match=api.findProduct(products,'injection',' 2.1.30171 ');assert.equal(match.defaultPeople,2);assert.equal(match.standardSeconds,5);
});
test('hourly labor uses the staff of each recorded hour, including fractional staff',()=>{
 const work=api.quickWorkshop(api.shifts[0].value);work.entryMode='hourly';work.standardLaborSeconds=12;work.hours=work.hours.slice(0,2).map((hour,index)=>({...hour,plannedMinutes:60,people:index?1.5:2,good:100,rejects:0,stopMinutes:0}));close(api.workshopLabor(work).spentHours,3.5);close(api.workshopSummary([report(work)]).dle,200*12/(3.5*3600)*100);
});
test('old reports retain the former DLE convention and mixed conventions are explicitly unavailable',()=>{
 const old=api.newWorkshop();old.allocatedLaborHours=3;old.requiredLaborHours=2;assert.equal(api.workshopSummary([report(old)]).dle,150);const work=api.quickWorkshop(api.shifts[0].value);work.totals.good=500;work.totals.people=2;work.standardLaborSeconds=12;const summary=api.workshopSummary([report(old),report(work)]);assert.equal(summary.dle,null);assert.equal(summary.mixedLaborRules,true);
});
for(const department of ['injection','assemblage','serigraphie'])test(department+': Excel DLE matches entry and actual staffing with standard-output calculation',()=>{
 const product=api.initialProductStandards.find(item=>item.department===department);const work=api.applyProductStandard(api.quickWorkshop(api.shifts[0].value),product);work.totals.good=1000;work.totals.people=2;const current={...report(work),department,reference:product.reference};const prepared=api.prepareReportForExcel(current);const files=unzipSync(api.exportWorkbook(department,[current]));const template=templates[department],xml=strFromU8(files[template.sheetPath]),key=department==='injection'?'AW':'BK';
 const cell=xml.match(new RegExp('<c\\b[^>]*\\br="'+key+template.startRow+'"[^>]*>[\\s\\S]*?</c>'))?.[0];assert.ok(cell);close(Number(cell.match(/<v[^>]*>([^<]*)<\/v>/)?.[1]),1000*product.standardSeconds/(2*8*3600));
 if(department==='injection')assert.match(api.automaticFormulas(prepared,template.startRow).AW,/AL\d+\/\(AM\d+\*AI\d+\)/);
 if(department==='assemblage')assert.match(api.automaticFormulas(prepared,template.startRow).BK,/W\d+\/\(T\d+\*60\*S\d+\)/);
});
console.log(JSON.stringify({passed}));
