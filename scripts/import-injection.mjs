import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// Local-only import. Use the API so normal validation and audit rules still apply.
const base='http://127.0.0.1:3000';
const inventory=JSON.parse(await readFile(new URL('../data/injection-machines.json',import.meta.url),'utf8'));
const request=(path,{method='GET',body,cookie}={})=>fetch(base+path,{method,headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
const session=await(await request('/api/session')).json();
if(session.storage!=='local'||!session.localSetup)throw new Error('Start the local development server before importing.');
const login=await request('/api/session',{method:'POST',body:{code:session.localSetup.entryCode}});
if(!login.ok)throw new Error('Local login failed');
const cookie=login.headers.get('set-cookie').split(';')[0];
const stateResponse=await request('/api/factory',{cookie});
if(!stateResponse.ok)throw new Error('Cannot read current machines');
const state=await stateResponse.json();
let created=0,updated=0,unchanged=0;
for(const [index,item] of inventory.entries()){
 const matches=state.machines.filter(m=>m.department==='injection'&&(m.inventory?.code===item.code||m.inventory?.serialNumber===item.serialNumber||m.name===item.code));
 if(matches.length>1)throw new Error('Several existing machines match '+item.code);
 const existing=matches[0];
 if(existing&&JSON.stringify(existing.inventory)===JSON.stringify(item)){unchanged++;continue;}
 const machine={...(existing||{id:randomUUID(),name:item.code,department:'injection',status:'unknown',x:16+(index%4)*22,y:16+Math.floor(index/4)*22,line:'',reference:''}),inventory:item};
 const saved=await request('/api/factory',{method:'POST',cookie,body:{kind:'machine',value:machine}});
 if(!saved.ok)throw new Error(item.code+': '+await saved.text());
 existing?updated++:created++;
}
const final=await(await request('/api/factory',{cookie})).json();
for(const item of inventory){
 const matches=final.machines.filter(m=>m.inventory?.code===item.code);
 if(matches.length!==1||matches[0].inventory.serialNumber!==item.serialNumber)throw new Error('Verification failed: '+item.code);
}
console.log(JSON.stringify({created,updated,unchanged,verified:inventory.length}));
