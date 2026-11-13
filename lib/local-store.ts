import 'server-only';
import {markReportDeleted,type VersionedRecord} from './report-lifecycle';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {emptyState,type FactoryState,type Report} from './domain';

const directory=path.join(process.cwd(),'.local-data');
const dataPath=path.join(directory,'factory.json');
type LocalData={records:Record<string,VersionedRecord>};
let queue:Promise<unknown>=Promise.resolve();
async function read():Promise<LocalData>{try{return JSON.parse(await readFile(dataPath,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {records:{}};throw e;}}
export async function localCredentials(){
 await mkdir(directory,{recursive:true});const file=path.join(directory,'access.json');
 try{return JSON.parse(await readFile(file,'utf8')) as {ENTRY_ACCESS_CODE:string;MEETING_ACCESS_CODE:string;SESSION_SECRET:string};}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 const credentials={ENTRY_ACCESS_CODE:'SAISIE-'+randomBytes(3).toString('hex').toUpperCase(),MEETING_ACCESS_CODE:'REUNION-'+randomBytes(3).toString('hex').toUpperCase(),SESSION_SECRET:randomBytes(32).toString('hex')};
 try{await writeFile(file,JSON.stringify(credentials,null,2),{flag:'wx'});}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return JSON.parse(await readFile(file,'utf8'));throw e;}
 return credentials;
}
export async function localState():Promise<FactoryState>{const data=await read();const all=Object.entries(data.records).filter(([,record])=>!record.deleted_at);return {...emptyState,connected:true,products:all.filter(([k])=>k.startsWith('product:')).map(([,r])=>({...r.value,updated_at:r.updated_at})),machines:all.filter(([k])=>k.startsWith('machine:')).map(([,r])=>r.value),reports:all.filter(([k])=>k.startsWith('report:')).map(([,r])=>({...r.value,updated_at:r.updated_at})),fiveSTags:all.filter(([k])=>k.startsWith('five_s_tag:')).map(([,r])=>({...r.value,updated_at:r.updated_at})),fiveSAudits:all.filter(([k])=>k.startsWith('five_s_audit:')).map(([,r])=>({...r.value,updated_at:r.updated_at})),actions:all.filter(([k])=>k.startsWith('action:')).map(([,r])=>r.value),settings:data.records['settings:main']?.value||{green:95,yellow:85,metricApproved:true}};}
export function localPut(kind:string,id:string,value:any,actor:string,expected?:string):Promise<string>{
 const operation=queue.then(async()=>{await mkdir(directory,{recursive:true});const data=await read();const key=kind+':'+id;const current=data.records[key];
 if(current?.deleted_at)throw new Error('Cette saisie a été supprimée. Créez une nouvelle saisie.');
 if(expected&&current&&current.updated_at!==expected)throw new Error('Cette saisie a changé. Rechargez-la avant de corriger.');
 const at=new Date().toISOString();const history=[{at,actor,report:value},...(current?.history||[])];data.records[key]={value,updated_at:at,history};
 const temp=dataPath+'.'+randomBytes(4).toString('hex')+'.tmp';await writeFile(temp,JSON.stringify(data,null,2));await rename(temp,dataPath);return at;
 });queue=operation.catch(()=>{});return operation;
}
export async function localVersions(id:string){return (await read()).records['report:'+id]?.history||[];}

export async function localJsonRecords(){return (await read()).records;}
export function localDeleteReport(id:string,expected:string,actor:string):Promise<string>{
 const operation=queue.then(async()=>{
  await mkdir(directory,{recursive:true});const data=await read(),key='report:'+id;
  data.records[key]=markReportDeleted(data.records[key],expected,actor);
  const temp=dataPath+'.'+randomBytes(4).toString('hex')+'.tmp';
  await writeFile(temp,JSON.stringify(data,null,2));await rename(temp,dataPath);
  return data.records[key].deleted_at!;
 });queue=operation.catch(()=>{});return operation;
}
