import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
await mkdir('.sites-runtime/tests',{recursive:true});
const result=await build({stdin:{contents:"export * from './lib/excel.ts';export * from './lib/domain.ts';export * from './lib/cell-calculation.ts';export * from './lib/metrics.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,tsconfig:'tsconfig.json'});
await writeFile('.sites-runtime/tests/core.mjs',result.outputFiles[0].contents);
const api=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/core.mjs'));
const templates=JSON.parse(await readFile('data/templates.json','utf8'));
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
for(const department of Object.keys(templates)){
 const t=templates[department];const cells=department==='injection'?{A:'INJ-TEST',C:'Équipe du matin',E:'REF<&01',AD:130,AF:8,AI:1,AJ:1300,AR:200,AQ:'Points noirs'}:department==='metalisation'?{A:'2026-10-26',B:'MET-TEST',C:'Équipe du matin',H:'REF<&01',L:1000,N:900,O:20,P:5,AB:8}:{A:'2026-10-26',B:'Équipe du matin',C:'ASM-TEST',F:'REF<&01',N:20000,R:4,S:4,T:6,P:10856,AI:189};
 const report={id:crypto.randomUUID(),date:'2026-10-26',department,shift:'Équipe du matin',machine_id:crypto.randomUUID(),reference:'REF<&01',status:'validated',cells,metrics:api.metricsFromCells(department,cells)};
 const original=unzipSync(api.sourceBytes(department));const output=unzipSync(api.exportWorkbook(department,[report]));
 test(department+': all ZIP members and unaffected parts preserved',()=>{assert.deepEqual(Object.keys(output).sort(),Object.keys(original).sort());for(const n of Object.keys(original)){if(n!==t.sheetPath&&n!=='xl/workbook.xml')assert.deepEqual(output[n],original[n],n);}});
 const before=strFromU8(original[t.sheetPath]),after=strFromU8(output[t.sheetPath]);
 test(department+': layout and print metadata preserved',()=>{for(const tag of ['cols','mergeCells','sheetViews','sheetFormatPr','pageMargins','pageSetup','printOptions','headerFooter','conditionalFormatting','drawing']){const re=new RegExp('<'+tag+'\\b[^>]*(?:/>|>[\\s\\S]*?</'+tag+'>)','g');assert.deepEqual(after.match(re),before.match(re),tag);}});
 test(department+': formulas preserved for existing cells',()=>{const get=s=>Object.fromEntries([...s.matchAll(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)].filter(m=>/<f\b/.test(m[0])).map(m=>[m[0].match(/r="([A-Z]+\d+)"/)?.[1],m[0].match(/<f\b[^>]*(?:\/>|>[\s\S]*?<\/f>)/)?.[0]]));const b=get(before),a=get(after);for(const [key,f] of Object.entries(b)){const column=key.replace(/\d/g,'');if(t.columns.find(c=>c.key===column)?.overrideAllowed&&key.endsWith(String(t.startRow))&&cells[column]!==undefined)continue;assert.equal(a[key],f,key);}});
 test(department+': raw inputs round-trip, escaped strings and no sample rows',()=>{const rows=api.importWorkbook(department,api.exportWorkbook(department,[report]),report.date,report.shift);assert.equal(rows.length,1);assert.equal(rows[0].reference,'REF<&01');const key=department==='injection'?'AJ':department==='metalisation'?'N':'P';assert.equal(Number(rows[0].cells[key]),cells[key]);});
 test(department+': cloned rows remain parseable and preserve references',()=>{const more=api.exportWorkbook(department,[report,{...report,id:crypto.randomUUID(),cells:{...cells,[department==='injection'?'A':department==='metalisation'?'B':'C']:'SECOND'}}]);assert.equal(api.importWorkbook(department,more,report.date,report.shift).length,2);});
}
test('Injection: local formulas recalculate with changes',()=>{const c={AD:130,AF:8,AI:1,AJ:1300,AR:200};const v=api.calculateCells('injection',c);assert.equal(v.J,720);assert.equal(v.R,720);assert.equal(v.AC,720);assert.ok(Math.abs(v.BB-1300/1500)<1e-9);const b=api.calculateCells('injection',{...c,AJ:2600});assert.ok(Math.abs(b.AL-v.AL*2)<1e-9);assert.equal(v.AK,null);});
test('Assembly: no machine/labor time confusion',()=>{const m=api.metricsFromCells('assemblage',{N:20000,R:4,S:4,T:6,P:10856,AV:30,AI:189});assert.equal(m.loadMinutes,330);assert.equal(m.laborMinutes,1440);assert.ok(Math.abs(m.earnedMinutes-1367.856)<1e-6);});
test('Missing data is unavailable; empty and draft reports excluded',()=>{assert.equal(api.summarize([]).oee,null);assert.equal(api.summarize([]).planning,null);const state=api.sampleState();assert.equal(api.summarize(state.reports.map(r=>({...r,status:'draft'}))).count,0);});
test('Exports reject unknown departments, missing data and excessive rows',()=>{assert.throws(()=>api.sourceBytes('../secret'));assert.throws(()=>api.exportWorkbook('injection',[]));assert.throws(()=>api.exportWorkbook('metalisation',Array.from({length:9},()=>({cells:{}}))));});
console.log(JSON.stringify({passed}));
