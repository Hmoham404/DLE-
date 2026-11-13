import { cookies,headers } from 'next/headers';
import {canonicalShift} from './shifts';
import {allowAutomaticLocalAccess} from './access-mode';
import type { Action, FactoryState, Machine, Report } from './domain';
import { emptyState, departments } from './domain';
import { metricsFromCells } from './metrics';
import { z } from 'zod';
import {workshopSchema,workshopMetrics,validateWorkshop} from './workshop';
import {localCredentials,localState,localPut,localVersions,localJsonRecords,localDeleteReport} from './local-store';
import {cloudLoadState,cloudPutRecord,cloudReportVersions,cloudStoredRecords} from './cloud-store';
import {workspaceLoadState,workspacePutRecord,workspaceReportVersions,readCloudWorkspace,workspaceDeleteReport} from './cloud-workspace';
type Runtime = {
    SUPABASE_URL: string;
    SUPABASE_SECRET_KEY: string;
    ENTRY_ACCESS_CODE: string;
    MEETING_ACCESS_CODE: string;
    SESSION_SECRET: string;
    DATA_ENCRYPTION_KEY: string;
    EXCEL_SERVICE_URL?: string;
    EXCEL_SERVICE_TOKEN?: string;
};
export const runtime = () => process.env as unknown as Runtime;
export const localMode=()=>process.env.MYC_STORAGE==='local'||(process.env.NODE_ENV==='development'&&process.env.MYC_STORAGE!=='supabase');
let configured:Promise<void>|null=null;
export async function ensureRuntime(){if(localMode()){configured??=localCredentials().then(c=>{for(const [key,value] of Object.entries(c))if(!process.env[key])process.env[key]=String(value);});await configured;}}
const encoder = new TextEncoder();
const b64 = (bytes: Uint8Array) => { let binary = ''; for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function sign(s: string) { const key = await crypto.subtle.importKey('raw', encoder.encode(runtime().SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(s)))); }
async function equal(a: string, b: string) { return await sign(a) === await sign(b); }
export async function session() {
    await ensureRuntime();
    if(allowAutomaticLocalAccess(process.env.MYC_LOCAL_AUTO_LOGIN,process.env.NODE_ENV,process.env.VERCEL,(await headers()).get('host'))){
        return {role:'entry',exp:Date.now()+8*60*60*1000,automatic:true} as {role:'entry'|'meeting';exp:number;automatic:boolean};
    }

    const value = (await cookies()).get('myc_session')?.value;
    if (!value)
        return null;
    const [payload, signature] = value.split('.');
    if (!signature || !await equal(signature, await sign(payload)))
        return null;
    try {
        const s = JSON.parse(new TextDecoder().decode(unb64(payload)));
        if (s.exp < Date.now() || !['entry', 'meeting'].includes(s.role))
            return null;
        return {role:s.role as 'entry'|'meeting',exp:s.exp as number,automatic:false};
    }
    catch {
        return null;
    }
}
export async function authorize(roles: ('entry' | 'meeting')[] = ['entry', 'meeting']) {
    // The signed session authorizes the selected shared-workspace role.
    const s = await session();
    if (!s)
        throw new Error('UNAUTHORIZED');
    if (!s.automatic && !roles.includes(s.role))
        throw new Error('FORBIDDEN');
    return s;
}
export async function login(code: string) {
    await ensureRuntime();
    if (!runtime().SESSION_SECRET || !runtime().ENTRY_ACCESS_CODE || !runtime().MEETING_ACCESS_CODE)
        throw new Error('Configuration des codes manquante.');
    const role = await equal(code, runtime().ENTRY_ACCESS_CODE) ? 'entry' : await equal(code, runtime().MEETING_ACCESS_CODE) ? 'meeting' : null;
    if (!role)
        throw new Error('Code d’accès incorrect.');
    const payload = b64(encoder.encode(JSON.stringify({ role, exp: Date.now() + 8 * 60 * 60 * 1000 })));
    (await cookies()).set('myc_session', payload + '.' + await sign(payload), { httpOnly: true, secure: process.env.NODE_ENV==='production', sameSite: 'strict', path: '/', maxAge: 28800 });
    return { role };
}
export async function db(path: string, init: RequestInit = {}) {
    const cfg = runtime();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SECRET_KEY)
        throw new Error('Connexion Supabase non configurée.');
    const response = await fetch(cfg.SUPABASE_URL + '/rest/v1/' + path, { ...init, headers: { apikey: cfg.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
        const message = await response.text();
        console.error('Supabase', response.status, message.slice(0, 200));
        throw new Error('Supabase a refusé l’opération. Vos modifications restent à l’écran.');
    }
    return response.status === 204 ? null : await response.json();
}
export async function loadState():Promise<FactoryState>{return localMode()?localState():process.env.MYC_STORAGE_FORMAT==='workspace-json-v1'?workspaceLoadState():cloudLoadState();}
export async function putRecord(kind:string,id:string,value:any,actor:string,expected?:string){return localMode()?localPut(kind,id,value,actor,expected):process.env.MYC_STORAGE_FORMAT==='workspace-json-v1'?workspacePutRecord(kind,id,value,actor,expected):cloudPutRecord(kind,id,value,actor,expected);}
export async function reportVersions(id:string){return localMode()?localVersions(id):process.env.MYC_STORAGE_FORMAT==='workspace-json-v1'?workspaceReportVersions(id):cloudReportVersions(id);}
export async function deleteReport(id:string,expected:string,actor:string){if(localMode())return localDeleteReport(id,expected,actor);if(process.env.MYC_STORAGE_FORMAT==='workspace-json-v1')return workspaceDeleteReport(id,expected,actor);throw new Error('La suppression nécessite le stockage JSON Supabase configuré.');}
export async function allJsonRecords(){if(localMode())return localJsonRecords();if(process.env.MYC_STORAGE_FORMAT==='workspace-json-v1')return (await readCloudWorkspace()).records;const records=await cloudStoredRecords();return Object.fromEntries(records.map(r=>[r.id,{value:r.payload.value,updated_at:r.updated_at,history:[{at:r.updated_at,actor:r.payload.actor,report:r.payload.value}]}]));}
const dep = z.enum(['injection', 'metalisation', 'serigraphie', 'assemblage']);
const inventorySchema = z.object({code:z.string().max(80),manufacturer:z.string().max(180),model:z.string().max(180),serialNumber:z.string().max(100),power:z.string().max(80),weight:z.string().max(80),voltage:z.string().max(80),frequency:z.string().max(80),manufacturedAt:z.string().max(80),acquiredAt:z.string().max(80),sourceFile:z.string().max(180),sourceSheet:z.string().max(80),sourceRow:z.number().int().positive(),category:z.string().max(180).optional(),zone:z.string().max(180).optional(),quantity:z.number().int().positive().max(10000).optional()});
export const machineSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80), department: dep, status: z.enum(['running', 'stopped', 'maintenance', 'idle', 'unknown']), x: z.number().min(0).max(100), y: z.number().min(0).max(100), reference: z.string().max(120).optional(), line: z.string().max(120).optional(), assetKind:z.enum(['production','line','support','tooling']).optional(), inventory:inventorySchema.optional() });
export const actionSchema = z.object({ id: z.string().uuid(), problem: z.string().trim().min(1).max(500), action: z.string().trim().min(1).max(1500), owner: z.string().trim().min(1).max(100), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.enum(['Haute', 'Normale', 'Basse']), status: z.enum(['Ouverte', 'En cours', 'Clôturée']), comment: z.string().max(2000), department: dep, closed_at: z.string().nullable().optional() });
export const reportSchema = z.object({ id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), department: dep, shift: z.string().min(1).max(80), machine_id: z.string().min(1).max(100), reference: z.string().max(200), status: z.enum(['draft', 'validated']), cells: z.record(z.union([z.string().max(4000), z.number().finite()])), updated_at: z.string().optional(), planningTarget: z.number().finite().min(0).nullable().optional(),workshop:workshopSchema.optional() });
export function parseReport(input: unknown): Report {
    const r = reportSchema.parse(input);
    r.shift=canonicalShift(r.shift);
    if(r.workshop){if(r.status==='validated'){if(!r.reference.trim())throw new Error('La r\u00e9f\u00e9rence produit est obligatoire.');validateWorkshop(r.workshop);}return {...r,metrics:workshopMetrics(r.workshop)};}
    const metrics = metricsFromCells(r.department, r.cells);
    metrics.planned = r.planningTarget ?? metrics.planned;
    if (r.status === 'validated') {
        if (!r.reference.trim())
            throw new Error('La référence produit est obligatoire.');
        const required = r.department === 'injection' ? ['AD', 'AF', 'AI', 'AJ'] : r.department === 'metalisation' ? ['H', 'L', 'N', 'AB'] : ['F', 'N', 'R', 'S', 'T', 'P'];
        for (const key of required)
            if (r.cells[key] === undefined || r.cells[key] === '')
                throw new Error(`Le champ ${key} du rapport est obligatoire pour valider.`);
        const numeric = r.department === 'injection' ? ['AD', 'AF', 'AI', 'AJ', 'AR', 'K', 'L', 'M', 'N', 'O', 'P', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA'] : r.department === 'metalisation' ? ['L', 'N', 'O', 'P', 'AB', 'AE', 'AG', 'AI', 'AK', 'AM', 'AO'] : ['N', 'O', 'P', 'R', 'S', 'T', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BD', 'BE', 'BF', 'BG'];
        for (const key of numeric) {
            const value = r.cells[key];
            if (value === undefined || value === '')
                continue;
            const n = Number(String(value).replace(',', '.'));
            if (!Number.isFinite(n) || n < 0)
                throw new Error(`Le champ ${key} doit être un nombre positif ou nul.`);
        }
        if (metrics.actual > 0 && metrics.loadMinutes <= 0)
            throw new Error('Renseignez une durée de production valide.');
        if (metrics.defects > metrics.actual)
            throw new Error('Les rebuts ne peuvent pas dépasser la production.');
        if (metrics.runMinutes > metrics.loadMinutes)
            throw new Error('Le temps de fonctionnement dépasse le temps de charge.');
        if (Object.values(metrics).some(v => typeof v === 'number' && v < 0) || Object.values(metrics.losses).some(v => v < 0) || Object.values(metrics.defectCategories).some(v => v < 0))
            throw new Error('Les quantités et durées doivent être positives.');
    }
    return { ...r, metrics };
}
export function failure(error:unknown){
 const code=error instanceof Error?error.message:'Une erreur est survenue.';
 const message=code==='UNAUTHORIZED'?'Ouvrez votre espace pour continuer.':code==='FORBIDDEN'?'Cette action n’est pas autorisée.':error instanceof z.ZodError?(error.issues.find(issue=>issue.code==='custom')?.message||'Les informations sont incomplètes ou invalides. Vérifiez les champs renseignés.'):code==='fetch failed'||code==='Failed to fetch'?'Connexion interrompue. Réessayez dans quelques instants.':error instanceof SyntaxError?'Le contenu envoyé est invalide.':code;
 return Response.json({error:message},{status:code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:400,headers:{'Cache-Control':'no-store'}});
}
export function checkOrigin(request:Request){
 const origin=request.headers.get('origin');if(!origin)return;
 const host=request.headers.get('host')||new URL(request.url).host;
 let caller:URL;try{caller=new URL(origin);}catch{throw new Error('FORBIDDEN');}
 // Native Next.js can normalize request.url to an internal hostname. The
 // incoming Host is the browser's actual destination, including its port.
 if(!['http:','https:'].includes(caller.protocol)||caller.host.toLowerCase()!==host.toLowerCase())throw new Error('FORBIDDEN');
}
