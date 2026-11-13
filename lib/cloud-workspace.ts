import 'server-only';
import {markReportDeleted,type VersionedRecord} from './report-lifecycle';
import {emptyState,type FactoryState,type Report} from './domain';
import {readCloudJson,readCloudDocument,writeCloudJson,removeCloudObjects,encryptPayload,decryptPayload,cloudPath} from './cloud-store';

export type JsonRecord=VersionedRecord;
export type JsonWorkspace={records:Record<string,JsonRecord>};
type Envelope={format:'myc-workspace-json-v1';revision:string;updated_at:string;payload:{format:string;iv:string;data:string}};
const file='workspace.json',lock='locks/workspace.json';
let cached:{context:string;etag:string|null;data:JsonWorkspace}|null=null;
function context(){return process.env.SUPABASE_URL+':'+cloudPath(file)+':'+process.env.DATA_ENCRYPTION_KEY;}
export async function readCloudWorkspace():Promise<JsonWorkspace>{
 const identity=context();
 const response=await readCloudDocument(file,cached?.context===identity?cached.etag:null);
 if(response.notModified&&cached?.context===identity)return structuredClone(cached.data);
 if(!response.value)throw new Error('Les données JSON Supabase ne sont pas encore initialisées.');
 const envelope=response.value as Envelope;
 if(envelope.format!=='myc-workspace-json-v1')throw new Error('Format JSON Supabase invalide.');
 const data=await decryptPayload(envelope.payload) as JsonWorkspace;
 if(!data||!data.records||typeof data.records!=='object')throw new Error('Données JSON Supabase invalides.');
 cached={context:identity,etag:response.etag,data};
 return structuredClone(data);
}
export async function updateCloudWorkspace<T>(change:(data:JsonWorkspace)=>T):Promise<T>{
 const token=crypto.randomUUID();
 await writeCloudJson(lock,{token,started_at:new Date().toISOString()},false);
 try{
  const data=await readCloudWorkspace();
  const result=change(data);
  const envelope:Envelope={format:'myc-workspace-json-v1',revision:crypto.randomUUID(),updated_at:new Date().toISOString(),payload:await encryptPayload(data)};
  await writeCloudJson(file,envelope,true);
  cached={context:context(),etag:null,data:structuredClone(data)};
  return result;
 }finally{
  try{const current=await readCloudJson(lock);if(current?.token===token)await removeCloudObjects([lock]);}
  catch{console.error('Supabase: vérifiez le verrou du fichier JSON avant une nouvelle écriture.');}
 }
}
export async function workspaceLoadState():Promise<FactoryState>{
 const {records}=await readCloudWorkspace();const entries=Object.entries(records).filter(([,record])=>!record.deleted_at);
 return {...emptyState,connected:true,
  products:entries.filter(([key])=>key.startsWith('product:')).map(([,record])=>({...record.value,updated_at:record.updated_at})),
  machines:entries.filter(([key])=>key.startsWith('machine:')).map(([,record])=>record.value),
  reports:entries.filter(([key])=>key.startsWith('report:')).map(([,record])=>({...record.value,updated_at:record.updated_at})),
  fiveSTags:entries.filter(([key])=>key.startsWith('five_s_tag:')).map(([,record])=>({...record.value,updated_at:record.updated_at})),
  fiveSAudits:entries.filter(([key])=>key.startsWith('five_s_audit:')).map(([,record])=>({...record.value,updated_at:record.updated_at})),
  actions:entries.filter(([key])=>key.startsWith('action:')).map(([,record])=>record.value),
  settings:records['settings:main']?.value||{green:95,yellow:85,metricApproved:true}};
}
export async function workspacePutRecord(kind:string,id:string,value:any,actor:string,expected?:string){
 return updateCloudWorkspace(data=>{
  const key=kind+':'+id,current=data.records[key];
  if(current?.deleted_at)throw new Error('Cette saisie a été supprimée. Créez une nouvelle saisie.');
  if(expected&&current&&current.updated_at!==expected)throw new Error('Ce rapport a été modifié ailleurs. Rechargez-le avant de corriger.');
  const now=new Date().toISOString();
  data.records[key]={value,updated_at:now,history:[{at:now,actor,report:value},...(current?.history||[])]};
  return now;
 });
}
export async function workspaceReportVersions(id:string){
 if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Identifiant de rapport invalide.');
 return (await readCloudWorkspace()).records['report:'+id]?.history.slice(0,100)||[];
}
export async function workspaceDeleteReport(id:string,expected:string,actor:string){
 return updateCloudWorkspace(data=>{
  const key='report:'+id;
  data.records[key]=markReportDeleted(data.records[key],expected,actor);
  return data.records[key].deleted_at!;
 });
}
