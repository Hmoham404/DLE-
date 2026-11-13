import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Adds supplied product standards through the application's authorized API.
// Existing references are left unchanged; all pre-existing records are checked.
const origin='http://127.0.0.1:3000';
async function request(path,options={}){
 const response=await fetch(origin+path,{...options,signal:AbortSignal.timeout(45000)});
 const value=await response.json();
 if(!response.ok)throw new Error(value.error||'HTTP '+response.status);
 return value;
}
await mkdir('.sites-runtime',{recursive:true});
await build({entryPoints:['lib/product-standards.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/product-seed.mjs',tsconfig:'tsconfig.json'});
const {initialProductStandards}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/product-seed.mjs'));
const before=await request('/api/backup');
assert.equal(before.format,'myc-factory-json-v1');
await mkdir('.local-data/backups',{recursive:true});
const backup='.local-data/backups/before-product-standards-'+new Date().toISOString().replaceAll(':','-')+'.json';
await writeFile(backup,JSON.stringify(before,null,2),{flag:'wx'});
const state=await request('/api/factory');
let added=0,skipped=0;
for(const product of initialProductStandards){
 if(state.products?.some(item=>item.id===product.id||(item.department===product.department&&item.reference===product.reference))){skipped++;continue;}
 await request('/api/factory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'product',value:product})});
 added++;
 console.log('Product standards saved: '+added);
}
const after=await request('/api/backup');
for(const [key,value] of Object.entries(before.records))assert.deepEqual(after.records[key],value,'Existing record changed: '+key);
for(const product of initialProductStandards){
 const saved=Object.entries(after.records).find(([key,record])=>key.startsWith('product:')&&record.value.department===product.department&&record.value.reference===product.reference);
 assert.ok(saved,'Missing saved reference '+product.reference);
}
console.log(JSON.stringify({added,skipped,preexistingRecordsPreserved:Object.keys(before.records).length,backup}));
