import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({stdin:{contents:"export * from './lib/five-s';export * from './lib/five-s-layout';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/five-s.mjs',tsconfig:'tsconfig.json'});
const api=await import(pathToFileURL(process.cwd()+'/.sites-runtime/tests/five-s.mjs'));
const fixture={...api.newFiveSTag(),title:'Outil',location:'Poste 1',owner:'Responsable'};
let passed=0;const test=(name,run)=>{run();passed++;console.log('PASS '+name);};
test('all four colors accept their corresponding material decision',()=>{for(const item of api.fiveSColors)assert.ok(api.fiveSTagSchema.safeParse({...fixture,color:item.id,destination:item.id==='bleu'?'Magasin':''}).success);});
test('5S covers all four departments and common spaces',()=>{for(const department of ['commun','injection','metalisation','serigraphie','assemblage'])assert.ok(api.fiveSTagSchema.safeParse({...fixture,department}).success);});
test('zones, workstations and machines are supported',()=>{for(const kind of ['zone','poste','machine'])assert.ok(api.fiveSTagSchema.safeParse({...fixture,kind}).success);});
test('both real factory plans can be selected',()=>{for(const plan of api.fiveSPlans)assert.ok(api.fiveSTagSchema.safeParse({...fixture,plan_id:plan.id}).success);});
test('blue tags require a relocation destination',()=>{const value=api.fiveSTagSchema.safeParse({...fixture,color:'bleu'});assert.equal(value.success,false);assert.match(value.error.issues[0].message,/destination/);});
test('coordinates cannot exceed the visible plan',()=>{for(const position of [{x:-1,y:50},{x:50,y:101},{x:NaN,y:50}])assert.equal(api.fiveSTagSchema.safeParse({...fixture,position}).success,false);assert.ok(api.fiveSTagSchema.safeParse({...fixture,position:{x:0,y:100}}).success);});
test('unpositioned tags remain explicit rather than inventing a location',()=>assert.equal(api.fiveSTagSchema.parse(fixture).position,null));
test('machine link cannot be attached to a zone or workstation',()=>assert.equal(api.fiveSTagSchema.safeParse({...fixture,machine_id:crypto.randomUUID()}).success,false));
test('bad dates return validation errors without throwing',()=>{for(const due_date of ['2099-13-01','2099-02-30','wrong','2099-00-01'])assert.equal(api.fiveSTagSchema.safeParse({...fixture,due_date}).success,false);for(const due_date of ['','2028-02-29'])assert.ok(api.fiveSTagSchema.safeParse({...fixture,due_date}).success);});
test('title, location and accountable owner are required',()=>{for(const field of ['title','location','owner'])assert.equal(api.fiveSTagSchema.safeParse({...fixture,[field]:'  '}).success,false);});
test('unknown colors and plans are rejected',()=>{assert.equal(api.fiveSTagSchema.safeParse({...fixture,color:'purple'}).success,false);assert.equal(api.fiveSTagSchema.safeParse({...fixture,plan_id:'../../secret'}).success,false);});
test('every reconstructed zone stays within its site and has a unique reference',()=>{
 const ids=new Set();
 for(const [plan,layout] of Object.entries(api.facilityLayouts))for(const zone of layout.zones){
  assert.ok(!ids.has(zone.id));ids.add(zone.id);
  assert.ok(api.contains(layout.bounds,{x:zone.rect.x,y:zone.rect.y}),zone.id);
  assert.ok(api.contains(layout.bounds,{x:zone.rect.x+zone.rect.w,y:zone.rect.y+zone.rect.h}),zone.id);
  assert.equal(api.zoneAt(plan,api.zoneCenter(zone))?.id,zone.id);
 }
});
test('3D projection round-trips source positions including margins and corners',()=>{
 for(const plan of Object.keys(api.facilityLayouts))for(const point of [{x:0,y:0},{x:100,y:100},{x:37.29,y:61.82}]){
  const [x,,z]=api.planToWorld(plan,point),result=api.worldToPlan(plan,x,z);
  assert.ok(Math.abs(point.x-result.x)<1e-10);assert.ok(Math.abs(point.y-result.y)<1e-10);
 }
});
test('creating in a zone supplies its actual site, department and location without a machine identity',()=>{
 for(const [plan,layout] of Object.entries(api.facilityLayouts))for(const zone of layout.zones){
  const tag=api.tagForZone(zone,plan,{...fixture});
  assert.equal(tag.plan_id,plan);assert.equal(tag.location,zone.name);assert.equal(tag.department,zone.department);assert.equal(tag.machine_id,null);
  assert.ok(api.fiveSTagSchema.safeParse(tag).success);
 }
});
test('zone lookup excludes tags on other sites and retains unpositioned or outside tags separately',()=>{
 const zone=api.facilityLayouts.injection.zones[0],tag=api.tagForZone(zone,'injection',fixture);
 assert.equal(api.tagsInZone([tag,{...tag,plan_id:'metalisation'},{...tag,position:null},{...tag,position:{x:0,y:0}}],'injection',zone).length,1);
 assert.equal(api.zoneAt('injection',null),undefined);assert.equal(api.zoneAt('injection',{x:0,y:0}),undefined);
});
test('repositioning a linked machine preserves its inventory identity and department',()=>{
 const tag={...fixture,kind:'machine',machine_id:crypto.randomUUID(),department:'injection',location:'Press linked'};
 const result=api.tagForZone(api.facilityLayouts.metalisation.zones[0],'metalisation',tag);
 assert.equal(result.machine_id,tag.machine_id);assert.equal(result.department,tag.department);assert.equal(result.location,tag.location);
});
console.log(JSON.stringify({passed}));
