import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({stdin:{contents:"export * from './lib/five-s-audits';export * from './lib/five-s-machines';export * from './lib/five-s-layout';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/five-s-audits.mjs',tsconfig:'tsconfig.json'});
const api=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/five-s-audits.mjs'));
const machine={id:crypto.randomUUID(),name:'MYC-01-INJ-0001',department:'injection',assetKind:'production',status:'unknown',x:16,y:16};
const fixture={...api.newFiveSAudit(machine,{x:35,y:38}),owner:'Auditeur'};
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
test('a planned audit requires a machine, real date and accountable owner',()=>{assert.ok(api.fiveSAuditSchema.safeParse(fixture).success);for(const change of [{owner:' '},{machine_id:'missing'},{scheduled_date:'2026-02-30'},{scheduled_time:'24:01'},{position:{x:101,y:20}}])assert.equal(api.fiveSAuditSchema.safeParse({...fixture,...change}).success,false);});
test('planning has no invented checklist ratings or score',()=>{assert.equal(api.auditScore(fixture),null);assert.ok(Object.values(fixture.checks).every(value=>value===null));});
test('completion requires every one of the five S to be evaluated',()=>{assert.equal(api.fiveSAuditSchema.safeParse({...fixture,status:'Terminé'}).success,false);assert.equal(api.fiveSAuditSchema.safeParse({...fixture,status:'En cours'}).success,true);});
const complete={...fixture,status:'Terminé',checks:{trier:0,ranger:1,nettoyer:2,standardiser:1,maintenir:2}};
test('the checklist score is derived from actual answers, including a valid zero',()=>{assert.equal(api.auditScore(complete),60);assert.equal(api.auditScore({checks:Object.fromEntries(api.fiveSCriteria.map(item=>[item.id,0]))}),0);assert.equal(api.fiveSAuditSchema.safeParse({...complete,checks:{...complete.checks,trier:3}}).success,false);});
test('server canonicalizes the machine identity and completion timestamp',()=>{const saved=api.prepareFiveSAudit({...complete,machine_name:'Wrong name'},machine,undefined,'2026-11-03T09:00:00.000Z');assert.equal(saved.machine_name,machine.name);assert.equal(saved.completed_at,'2026-11-03T09:00:00.000Z');assert.equal(saved.created_at,saved.completed_at);assert.ok(!('updated_at' in saved));});
const current={...complete,created_at:'2026-11-01T08:00:00.000Z',updated_at:'2026-11-03T09:00:00.000Z',completed_at:'2026-11-03T09:00:00.000Z'};
test('missing versions and stale versions cannot replace a saved audit',()=>{assert.throws(()=>api.prepareFiveSAudit(complete,machine,current),/modifié ailleurs/);assert.throws(()=>api.prepareFiveSAudit({...complete,updated_at:'2026-11-01T08:00:00.000Z'},machine,current),/modifié ailleurs/);});
test('a saved audit cannot silently switch machines or sites',()=>{assert.throws(()=>api.prepareFiveSAudit({...current,machine_id:crypto.randomUUID()},machine,current),/machine/);assert.throws(()=>api.prepareFiveSAudit({...fixture,plan_id:'metalisation'},machine,undefined),/site/);assert.throws(()=>api.prepareFiveSAudit(fixture,undefined,undefined),/existe plus/);});
test('editing completion preserves its original date and reopening clears it',()=>{assert.equal(api.prepareFiveSAudit(current,machine,current).completed_at,current.completed_at);const reopened=api.prepareFiveSAudit({...current,status:'En cours'},machine,current);assert.equal(reopened.completed_at,null);assert.equal(reopened.created_at,current.created_at);});
const inventory=Array.from({length:16},(_,index)=>({...machine,id:crypto.randomUUID(),name:'MYC-01-INJ-'+String(index+1).padStart(4,'0')}));
test('the map renders exactly the real inventory, without twenty fake presses',()=>{const result=api.facilityMachines(inventory,'injection');assert.equal(result.length,16);assert.equal(new Set(result.map(item=>item.machine.id)).size,16);for(const item of result)assert.ok(api.contains(item.zone.rect,item.position));assert.equal(api.facilityMachines([],'injection').length,0);});
test('map positions stay deterministic when storage order changes and do not rewrite inventory coordinates',()=>{const first=api.facilityMachines(inventory,'injection'),second=api.facilityMachines([...inventory].reverse(),'injection');assert.deepEqual(first,second);assert.equal(inventory[0].x,16);assert.equal(inventory[0].y,16);});
test('site separation excludes foreign departments and auxiliary inventory',()=>{const units=[...inventory,{...machine,id:crypto.randomUUID(),department:'serigraphie'},{...machine,id:crypto.randomUUID(),assetKind:'tooling'}];assert.equal(api.facilityMachines(units,'injection').length,16);assert.equal(api.facilityMachines(units,'metalisation').length,1);});

// Exercise the real route with an in-memory server adapter. No Supabase writes.
globalThis.__auditTestStore={state:{machines:[machine],fiveSAudits:[]},writes:[],role:'entry'};
await build({entryPoints:['app/api/five-s/audits/route.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/five-s-audit-route.mjs',tsconfig:'tsconfig.json',plugins:[{name:'memory-server',setup(build){
 build.onResolve({filter:/^@\/lib\/server$/},()=>({path:'server',namespace:'memory-server'}));
 build.onLoad({filter:/.*/,namespace:'memory-server'},()=>({contents:`
 export const authorize=async()=>{const role=globalThis.__auditTestStore.role;if(!role)throw new Error('UNAUTHORIZED');return {role};};
 export const checkOrigin=request=>{if(request.headers.get('origin')!=='http://localhost:3000')throw new Error('FORBIDDEN');};
 export const loadState=async()=>structuredClone(globalThis.__auditTestStore.state);
 export const putRecord=async(kind,id,value,actor,expected)=>{const store=globalThis.__auditTestStore;store.writes.push({kind,id,value,actor,expected});store.state.fiveSAudits=[{...value,updated_at:'2026-11-03T12:00:00.000Z'}];};
 export const failure=error=>Response.json({error:error.message||'Invalid'}, {status:400});`,loader:'js'}));
}}]});
const {POST}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/five-s-audit-route.mjs'));
const request=(body,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/five-s/audits',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
assert.equal((await POST(request(fixture))).status,200);test('the real route persists a separate audit record with machine linkage',()=>{const write=globalThis.__auditTestStore.writes[0];assert.equal(write.kind,'five_s_audit');assert.equal(write.value.machine_id,machine.id);assert.equal(write.value.status,'Planifié');});
assert.equal((await POST(request(fixture))).status,400);test('the real route rejects an unversioned replacement without writing',()=>assert.equal(globalThis.__auditTestStore.writes.length,1));
assert.equal((await POST(request({...fixture,id:crypto.randomUUID()},'http://elsewhere.example'))).status,400);
globalThis.__auditTestStore.role=null;assert.equal((await POST(request({...fixture,id:crypto.randomUUID()}))).status,400);test('cross-origin and unauthenticated requests cannot write audits',()=>assert.equal(globalThis.__auditTestStore.writes.length,1));
await build({entryPoints:['lib/local-store.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/audit-local-store.mjs',tsconfig:'tsconfig.json',plugins:[{name:'server-only-test',setup(build){build.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'empty'}));build.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export {};',loader:'js'}));}}]});
const originalDirectory=process.cwd(),localModule=pathToFileURL(path.join(originalDirectory,'.sites-runtime/tests/audit-local-store.mjs'));
await mkdir('outputs',{recursive:true});const temp=await mkdtemp(path.join(originalDirectory,'outputs/audit-storage-test-'));
try{
 process.chdir(temp);const storage=await import(localModule);
 await storage.localPut('machine',machine.id,machine,'entry');await storage.localPut('five_s_tag','preserved',{title:'Keep this tag'},'entry');
 const version=await storage.localPut('five_s_audit',fixture.id,fixture,'entry'),loaded=await storage.localState();
 test('the JSON storage loader restores the machine audit with its saved version',()=>{assert.equal(loaded.fiveSAudits.length,1);assert.equal(loaded.fiveSAudits[0].machine_id,machine.id);assert.equal(loaded.fiveSAudits[0].updated_at,version);assert.equal(loaded.machines.length,1);});
 await storage.localPut('five_s_audit',fixture.id,{...complete},'meeting',version);
 const records=await storage.localJsonRecords();
 test('audit revisions are kept in the complete JSON backup alongside existing tags',()=>{assert.equal(records['five_s_audit:'+fixture.id].history.length,2);assert.equal(records['five_s_audit:'+fixture.id].value.status,'Terminé');assert.equal(records['five_s_tag:preserved'].value.title,'Keep this tag');});
 await assert.rejects(storage.localPut('five_s_audit',fixture.id,fixture,'entry','2000-01-01T00:00:00.000Z'));
 const afterRejection=await storage.localState();
 test('the storage lock refuses a stale overwrite and retains the completed audit',()=>assert.equal(afterRejection.fiveSAudits[0].status,'Terminé'));
}finally{process.chdir(originalDirectory);}
console.log(JSON.stringify({passed}));
