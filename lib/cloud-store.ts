import 'server-only';
import {emptyState,type FactoryState,type Report} from './domain';

export type StoredRecord={id:string;payload:{value:any;actor:string;previous:string|null};updated_at:string};
type EncryptedRecord={id:string;payload:{format:string;iv:string;data:string};updated_at:string};
type ObjectInfo={id:string|null;name:string;updated_at?:string;created_at?:string};
export const cloudBucket='myc-smart-factory-private';
const encoder=new TextEncoder();
const cache=new Map<string,{revision:string;record:StoredRecord}>();
let cacheContext='';
let pendingLoad:Promise<StoredRecord[]>|null=null;

function configuration(){
 const url=process.env.SUPABASE_URL?.replace(/\/+$/,'');
 const secret=process.env.SUPABASE_SECRET_KEY;
 const namespace=process.env.MYC_STORAGE_NAMESPACE||'';
 if(!url||!secret)throw new Error('Connexion Supabase non configurée.');
 if(namespace&&!/^[a-zA-Z0-9_-]{1,100}$/.test(namespace))throw new Error('Espace Supabase invalide.');
 return {url,secret,namespace};
}
export function cloudPath(path:string){const {namespace}=configuration();return namespace?namespace+'/'+path:path;}
async function request(path:string,options:RequestInit={}){
 const {url,secret}=configuration();
 return fetch(url+'/storage/v1/'+path,{...options,cache:'no-store',headers:{apikey:secret,...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{}),'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(20000)});
}
function encoded(path:string){return path.split('/').map(encodeURIComponent).join('/');}
function base64(bytes:Uint8Array){let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function unbase64(value:string){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
async function encryptionKey(){
 const secret=process.env.DATA_ENCRYPTION_KEY;
 if(!secret)throw new Error('Clé de chiffrement des données manquante.');
 return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(secret)),'AES-GCM',false,['encrypt','decrypt']);
}
export async function encryptPayload(value:unknown){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),encoder.encode(JSON.stringify(value)));
 return {format:'myc-encrypted-v1',iv:base64(iv),data:base64(new Uint8Array(encrypted))};
}
export async function decryptPayload(value:{format?:string;iv:string;data:string}){
 try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(value.iv)},await encryptionKey(),unbase64(value.data));return JSON.parse(new TextDecoder().decode(plain));}
 catch{throw new Error('Lecture du JSON chiffré impossible. Vérifiez la clé de chiffrement Supabase.');}
}
export async function readCloudDocument(path:string,etag:string|null=null):Promise<{value:any|null;etag:string|null;notModified:boolean}>{
 for(let attempt=0;attempt<4;attempt++){
  const response=await request('object/authenticated/'+cloudBucket+'/'+encoded(cloudPath(path)),{headers:etag?{'If-None-Match':etag}:{}});
  if(response.status===304)return {value:null,etag,notModified:true};
  if(response.ok)return {value:await response.json(),etag:response.headers.get('etag'),notModified:false};
  const detail:any=await response.json().catch(()=>({}));
  if(response.status===404||detail.statusCode==='404'||detail.error==='not_found'||detail.message==='Object not found')return {value:null,etag:null,notModified:false};
  if(![408,429,500,502,503,504].includes(response.status)||attempt===3)throw new Error('Lecture Supabase indisponible (HTTP '+response.status+').');
  await new Promise(resolve=>setTimeout(resolve,500*Math.pow(2,attempt)));
 }
 throw new Error('Lecture Supabase indisponible.');
}
export async function readCloudJson(path:string):Promise<any|null>{return (await readCloudDocument(path)).value;}
export async function writeCloudJson(path:string,value:unknown,upsert=false){
 let failure='Connexion Supabase indisponible. Vos modifications restent à l’écran.';
 for(let attempt=0;attempt<4;attempt++){
  let retry=true;
  try{
   const response=await request('object/'+cloudBucket+'/'+encoded(cloudPath(path)),{method:'POST',headers:{'x-upsert':String(upsert),'cache-control':'max-age=0'},body:JSON.stringify(value)});
   if(response.ok)return;
   const detail:any=await response.json().catch(()=>({}));
   failure='Écriture Supabase refusée (HTTP '+response.status+'). Réessayez.';
   retry=[408,429,500,502,503,504].includes(response.status);
   if(!retry){try{const saved=await readCloudJson(path);if(saved&&JSON.stringify(saved)===JSON.stringify(value))return;}catch{}throw new Error(failure);}
  }catch(error){if(!retry)throw error;}
  try{const saved=await readCloudJson(path);if(saved&&JSON.stringify(saved)===JSON.stringify(value))return;}catch{}
  if(attempt<3)await new Promise(resolve=>setTimeout(resolve,500*Math.pow(2,attempt)));
 }
 throw new Error(failure);
}
export async function removeCloudObjects(paths:string[]){
 const response=await request('object/'+cloudBucket,{method:'DELETE',body:JSON.stringify({prefixes:paths.map(cloudPath)})});
 if(!response.ok)throw new Error('Nettoyage Supabase indisponible (HTTP '+response.status+').');
 for(const path of paths)cache.delete(path);
 pendingLoad=null;
}
export async function listCloudObjects(prefix:string):Promise<ObjectInfo[]>{
 const result:ObjectInfo[]=[];
 for(let offset=0;;offset+=500){
  const response=await request('object/list/'+cloudBucket,{method:'POST',body:JSON.stringify({prefix:cloudPath(prefix),limit:500,offset,sortBy:{column:'name',order:'asc'}})});
  if(!response.ok)throw new Error('Le stockage privé Supabase est indisponible (HTTP '+response.status+').');
  const batch=await response.json() as ObjectInfo[];result.push(...batch);
  if(batch.length<500)return result;
 }
}
export async function readStoredRecord(path:string):Promise<StoredRecord|null>{
 const stored=await readCloudJson(path) as EncryptedRecord|null;
 return stored?{...stored,payload:await decryptPayload(stored.payload)}:null;
}
async function boundedMap<T,R>(values:T[],mapper:(value:T)=>Promise<R>,width=20):Promise<R[]>{
 const result:R[]=new Array(values.length);let next=0;
 await Promise.all(Array.from({length:Math.min(width,values.length)},async()=>{while(next<values.length){const index=next++;result[index]=await mapper(values[index]);}}));
 return result;
}
export async function cloudStoredRecords():Promise<StoredRecord[]>{
 const cfg=configuration();const context=cfg.url+':'+cfg.namespace+':'+process.env.DATA_ENCRYPTION_KEY;
 if(cacheContext!==context){cache.clear();pendingLoad=null;cacheContext=context;}
 if(pendingLoad)return pendingLoad;
 const operation=(async()=>{
  const objects=(await listCloudObjects('records')).filter(object=>object.id);
  const paths=new Set(objects.map(object=>'records/'+object.name));
  for(const path of cache.keys())if(!paths.has(path))cache.delete(path);
  const records=await boundedMap(objects,async object=>{
   const path='records/'+object.name,revision=object.updated_at||object.created_at||'';
   const cached=cache.get(path);
   if(revision&&cached?.revision===revision)return cached.record;
   const record=await readStoredRecord(path);
   if(record)cache.set(path,{revision,record});else cache.delete(path);
   return record;
  });
  return records.filter((record):record is StoredRecord=>!!record);
 })();
 pendingLoad=operation;
 try{return await operation;}finally{if(pendingLoad===operation)pendingLoad=null;}
}
export async function cloudLoadState():Promise<FactoryState>{
 const records=await cloudStoredRecords();
 return {...emptyState,connected:true,
  products:records.filter(r=>r.id.startsWith('product:')).map(r=>({...r.payload.value,updated_at:r.updated_at})),
  machines:records.filter(r=>r.id.startsWith('machine:')).map(r=>r.payload.value),
  reports:records.filter(r=>r.id.startsWith('report:')).map(r=>({...r.payload.value,updated_at:r.updated_at})),
  fiveSTags:records.filter(r=>r.id.startsWith('five_s_tag:')).map(r=>({...r.payload.value,updated_at:r.updated_at})),
  fiveSAudits:records.filter(r=>r.id.startsWith('five_s_audit:')).map(r=>({...r.payload.value,updated_at:r.updated_at})),
  actions:records.filter(r=>r.id.startsWith('action:')).map(r=>r.payload.value),
  settings:records.find(r=>r.id==='settings:main')?.payload.value||emptyState.settings};
}
export async function cloudPutRecord(kind:string,id:string,value:any,actor:string,expected?:string){
 const path='records/'+kind+'-'+id+'.json',lock='locks/'+kind+'-'+id+'.json';
 await writeCloudJson(lock,{started_at:new Date().toISOString()},false);
 try{
  const current=await readStoredRecord(path);
  if(expected&&current&&current.updated_at!==expected)throw new Error('Ce rapport a été modifié ailleurs. Rechargez-le avant de corriger.');
  const now=new Date().toISOString();
  const record={id:kind+':'+id,payload:await encryptPayload({value,actor,previous:current?.updated_at||null}),updated_at:now};
  await writeCloudJson('audit/'+kind+'-'+id+'/'+crypto.randomUUID()+'.json',record,false);
  await writeCloudJson(path,record,true);
  cache.delete(path);pendingLoad=null;
  return now;
 }finally{
  try{await removeCloudObjects([lock]);}catch{console.error('Supabase: le verrou n’a pas pu être nettoyé.');}
 }
}
export async function cloudReportVersions(id:string){
 if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Identifiant de rapport invalide.');
 const objects=(await listCloudObjects('audit/report-'+id)).filter(object=>object.id);
 const decoded=await boundedMap(objects,object=>readStoredRecord('audit/report-'+id+'/'+object.name));
 const current=await readStoredRecord('records/report-'+id+'.json');
 const byDate=new Map(decoded.filter((r):r is StoredRecord=>!!r).map(r=>[r.updated_at,r]));
 const versions:{at:string;actor:string;report:Report}[]=[];let cursor=current?.updated_at;
 while(cursor&&byDate.has(cursor)&&versions.length<100){const stored=byDate.get(cursor)!;versions.push({at:stored.updated_at,actor:stored.payload.actor,report:stored.payload.value});cursor=stored.payload.previous||undefined;}
 return versions;
}
