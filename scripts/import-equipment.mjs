import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

const base='http://127.0.0.1:3000';
const catalog=JSON.parse(await readFile(new URL('../data/equipment-catalog.json',import.meta.url),'utf8'));
const request=async(path,{body,cookie}={})=>{
 const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:base,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 if(!response.ok)throw new Error(path+': '+response.status+' '+await response.text());
 return response;
};
const session=await(await request('/api/session')).json();
if(session.storage!=='local'||!session.localSetup)throw new Error('Start the local development server first.');
const login=await request('/api/session',{body:{code:session.localSetup.entryCode}});
const cookie=login.headers.get('set-cookie').split(';')[0];
const state=await(await request('/api/factory',{cookie})).json();
const beforeReports=JSON.stringify(state.reports),beforeActions=JSON.stringify(state.actions);
let created=0,updated=0,unchanged=0;
const indices={};
for(const item of catalog){
 const key=item.inventory?`${item.inventory.sourceFile}:${item.inventory.sourceRow}`:`unit:${item.department}:${item.name}`;
 const matches=state.machines.filter(m=>item.inventory?
  m.inventory?.sourceFile===item.inventory.sourceFile&&m.inventory?.sourceRow===item.inventory.sourceRow:
  m.department===item.department&&m.name===item.name);
 if(matches.length>1)throw new Error('Duplicate existing source identity: '+key);
 const existing=matches[0];
 const index=indices[item.department]||0;indices[item.department]=index+1;
 const value=existing?{...existing,assetKind:existing.assetKind||item.assetKind,...(item.inventory?{inventory:{...item.inventory,...existing.inventory}}:{})}:
  {...item,id:randomUUID(),status:'unknown',x:10+(index%5)*18,y:10+(Math.floor(index/5)%5)*18,reference:''};
 if(existing&&JSON.stringify(existing)===JSON.stringify(value)){unchanged++;continue;}
 await request('/api/factory',{cookie,body:{kind:'machine',value}});
 if(existing){state.machines[state.machines.indexOf(existing)]=value;updated++;}else{state.machines.push(value);created++;}
}
const final=await(await request('/api/factory',{cookie})).json();
if(JSON.stringify(final.reports)!==beforeReports||JSON.stringify(final.actions)!==beforeActions)throw new Error('Production data changed unexpectedly');
for(const item of catalog){
 const matches=final.machines.filter(m=>item.inventory?
  m.inventory?.sourceFile===item.inventory.sourceFile&&m.inventory?.sourceRow===item.inventory.sourceRow:
  m.department===item.department&&m.name===item.name);
 if(matches.length!==1)throw new Error('Verification failed: '+item.name);
}
console.log(JSON.stringify({created,updated,unchanged,verified:catalog.length,departments:Object.fromEntries(['injection','serigraphie','metalisation','assemblage'].map(d=>[d,final.machines.filter(m=>m.department===d).length]))}));
