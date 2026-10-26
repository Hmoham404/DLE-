import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { Action, FactoryState, Machine, Report } from './domain';
import { emptyState, departments } from './domain';
import { metricsFromCells } from './metrics';
import { z } from 'zod';
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
export const runtime = () => env as unknown as Runtime;
const encoder = new TextEncoder();
const bucket = 'myc-smart-factory-private';
const b64 = (bytes: Uint8Array) => { let binary = ''; for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function sign(s: string) { const key = await crypto.subtle.importKey('raw', encoder.encode(runtime().SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(s)))); }
async function equal(a: string, b: string) { return await sign(a) === await sign(b); }
export async function session() {
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
        return s as {
            role: 'entry' | 'meeting';
            exp: number;
        };
    }
    catch {
        return null;
    }
}
export async function authorize(roles: ('entry' | 'meeting')[] = ['entry', 'meeting']) {
    // Sites enforces the owner's private access boundary. A code grants the
    // narrower shared-workspace role; no Supabase user account is created.
    const s = await session();
    if (!s)
        throw new Error('UNAUTHORIZED');
    if (!roles.includes(s.role))
        throw new Error('FORBIDDEN');
    return s;
}
export async function login(code: string) {
    if (!runtime().SESSION_SECRET || !runtime().ENTRY_ACCESS_CODE || !runtime().MEETING_ACCESS_CODE)
        throw new Error('Configuration des codes manquante.');
    const role = await equal(code, runtime().ENTRY_ACCESS_CODE) ? 'entry' : await equal(code, runtime().MEETING_ACCESS_CODE) ? 'meeting' : null;
    if (!role)
        throw new Error('Code d’accès incorrect.');
    const payload = b64(encoder.encode(JSON.stringify({ role, exp: Date.now() + 8 * 60 * 60 * 1000 })));
    (await cookies()).set('myc_session', payload + '.' + await sign(payload), { httpOnly: true, secure: !import.meta.env.DEV, sameSite: 'strict', path: '/', maxAge: 28800 });
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
async function cipherKey() { if (!runtime().DATA_ENCRYPTION_KEY)
    throw new Error('Clé de chiffrement des données manquante.'); const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(runtime().DATA_ENCRYPTION_KEY)); return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function encrypt(payload: unknown) { const iv = crypto.getRandomValues(new Uint8Array(12)); const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cipherKey(), encoder.encode(JSON.stringify(payload))); return { format: 'myc-encrypted-v1', iv: b64(iv), data: b64(new Uint8Array(bytes)) }; }
async function decrypt(payload: {
    iv: string;
    data: string;
}) { const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(payload.iv) }, await cipherKey(), unb64(payload.data)); return JSON.parse(new TextDecoder().decode(plain)); }
type Stored = {
    id: string;
    payload: any;
    updated_at: string;
};
async function storage(path: string, init: RequestInit = {}) {
    const cfg = runtime();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SECRET_KEY)
        throw new Error('Connexion Supabase non configurée.');
    return fetch(cfg.SUPABASE_URL + '/storage/v1/' + path, { ...init, headers: { apikey: cfg.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json', ...init.headers }, signal: AbortSignal.timeout(15000) });
}
async function readObject(path: string): Promise<Stored | null> {
    const res = await storage('object/authenticated/' + bucket + '/' + path);
    if (!res.ok) {
        const b: any = await res.json().catch(() => ({}));
        if (res.status === 404 || b.statusCode === '404' || b.error === 'not_found' || b.message === 'Object not found')
            return null;
        throw new Error('Lecture Supabase indisponible. Réessayez.');
    }
    const data: any = await res.json();
    return { ...data, payload: await decrypt(data.payload) };
}
async function writeObject(path: string, value: unknown, upsert = false) { const r = await storage('object/' + bucket + '/' + path, { method: 'POST', headers: { 'x-upsert': String(upsert) }, body: JSON.stringify(value) }); if (!r.ok)
    throw new Error(upsert ? 'Enregistrement Supabase refusé. Vos modifications restent à l’écran.' : 'Une modification est déjà en cours. Réessayez dans quelques instants.'); }
async function removeObject(path: string) { const r = await storage('object/' + bucket, { method: 'DELETE', body: JSON.stringify({ prefixes: [path] }) }); if (!r.ok)
    console.error('Storage lock cleanup failed', r.status); }
export async function loadState(): Promise<FactoryState> {
    let names: string[] = [];
    for (let offset = 0;; offset += 500) {
        const response = await storage('object/list/' + bucket, { method: 'POST', body: JSON.stringify({ prefix: 'records', limit: 500, offset, sortBy: { column: 'name', order: 'asc' } }) });
        if (!response.ok)
            throw new Error('Le stockage privé Supabase est indisponible.');
        const chunk = await response.json() as {
            name: string;
            id: string | null;
        }[];
        names.push(...chunk.filter(r => r.id).map(r => r.name));
        if (chunk.length < 500)
            break;
    }
    const decoded: Stored[] = [];
    for (let i = 0; i < names.length; i += 10) {
        const chunk = await Promise.all(names.slice(i, i + 10).map(n => readObject('records/' + n)));
        decoded.push(...chunk.filter((r): r is Stored => !!r));
    }
    return { ...emptyState, connected: true, machines: decoded.filter(r => r.id.startsWith('machine:')).map(r => r.payload.value), reports: decoded.filter(r => r.id.startsWith('report:')).map(r => ({ ...r.payload.value, updated_at: r.updated_at })), actions: decoded.filter(r => r.id.startsWith('action:')).map(r => r.payload.value), settings: decoded.find(r => r.id === 'settings:main')?.payload.value || emptyState.settings };
}
export async function putRecord(kind: string, id: string, value: any, actor: string, expected?: string) {
    const key = kind + ':' + id, path = 'records/' + kind + '-' + id + '.json', lock = 'locks/' + kind + '-' + id + '.json';
    await writeObject(lock, { started_at: new Date().toISOString() }, false);
    try {
        const current = await readObject(path);
        if (expected && current && current.updated_at !== expected)
            throw new Error('Ce rapport a été modifié ailleurs. Rechargez-le avant de corriger.');
        const now = new Date().toISOString();
        const record = { id: key, payload: await encrypt({ value, actor, previous: current?.updated_at || null }), updated_at: now };
        await writeObject('audit/' + kind + '-' + id + '/' + crypto.randomUUID() + '.json', record, false);
        await writeObject(path, record, true);
        return now;
    }
    finally {
        await removeObject(lock);
    }
}
export async function reportVersions(id: string) {
    if (!/^[0-9a-f-]{36}$/.test(id))
        throw new Error('Identifiant de rapport invalide.');
    const res = await storage('object/list/' + bucket, { method: 'POST', body: JSON.stringify({ prefix: 'audit/report-' + id, limit: 100, sortBy: { column: 'created_at', order: 'desc' } }) });
    if (!res.ok)
        throw new Error('Historique indisponible.');
    const names = await res.json() as {
        name: string;
        id: string | null;
    }[];
    const versions = await Promise.all(names.filter(n => n.id).map(n => readObject('audit/report-' + id + '/' + n.name)));
    const current=await readObject('records/report-'+id+'.json');
    const byDate=new Map(versions.filter((v):v is Stored=>!!v).map(v=>[v.updated_at,v]));
    const committed:{at:string;actor:string;report:Report}[]=[];let cursor=current?.updated_at;
    while(cursor&&byDate.has(cursor)&&committed.length<100){const v=byDate.get(cursor)!;committed.push({at:v.updated_at,actor:v.payload.actor,report:v.payload.value});cursor=v.payload.previous;}
    return committed;
}
const dep = z.enum(['injection', 'metalisation', 'serigraphie', 'assemblage']);
export const machineSchema = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80), department: dep, status: z.enum(['running', 'stopped', 'maintenance', 'idle']), x: z.number().min(0).max(100), y: z.number().min(0).max(100), reference: z.string().max(120).optional(), line: z.string().max(120).optional() });
export const actionSchema = z.object({ id: z.string().uuid(), problem: z.string().trim().min(1).max(500), action: z.string().trim().min(1).max(1500), owner: z.string().trim().min(1).max(100), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), priority: z.enum(['Haute', 'Normale', 'Basse']), status: z.enum(['Ouverte', 'En cours', 'Clôturée']), comment: z.string().max(2000), department: dep, closed_at: z.string().nullable().optional() });
export const reportSchema = z.object({ id: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), department: dep, shift: z.string().min(1).max(80), machine_id: z.string().min(1).max(100), reference: z.string().max(200), status: z.enum(['draft', 'validated']), cells: z.record(z.union([z.string().max(4000), z.number().finite()])), updated_at: z.string().optional(), planningTarget: z.number().finite().min(0).nullable().optional() });
export function parseReport(input: unknown): Report {
    const r = reportSchema.parse(input);
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
export function failure(error: unknown) { const message = error instanceof Error ? error.message : 'Une erreur est survenue.'; return Response.json({ error: message }, { status: message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 400, headers: { 'Cache-Control': 'no-store' } }); }
export function checkOrigin(request: Request) { const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin)
    throw new Error('FORBIDDEN'); }
