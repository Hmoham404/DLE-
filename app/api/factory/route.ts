import { authorize, loadState, putRecord, machineSchema, actionSchema, parseReport, failure, checkOrigin } from '@/lib/server';
import { z } from 'zod';
export async function GET() { try {
    await authorize();
    return Response.json(await loadState(), { headers: { 'Cache-Control': 'no-store' } });
}
catch (error) {
    return failure(error);
} }
export async function POST(request: Request) {
    try {
        checkOrigin(request);
        const auth = await authorize();
        const body: any = await request.json();
        if (body.kind === 'machine') {
            if (auth.role !== 'entry')
                throw new Error('FORBIDDEN');
            const m = machineSchema.parse(body.value);
            const state = await loadState();
            if (state.machines.some(x => x.id !== m.id && x.department === m.department && x.name.toLowerCase() === m.name.toLowerCase()))
                throw new Error('Ce nom de machine existe déjà dans cet atelier.');
            await putRecord('machine', m.id, m, auth.role);
        }
        else if (body.kind === 'report') {
            if (auth.role !== 'entry')
                throw new Error('FORBIDDEN');
            const r = parseReport(body.value);
            const state = await loadState();
            if (!state.machines.some(m => m.id === r.machine_id && m.department === r.department))
                throw new Error('Choisissez une machine du département.');
            await putRecord('report', r.id, r, auth.role, r.updated_at);
        }
        else if (body.kind === 'action') {
            if (auth.role !== 'meeting')
                throw new Error('FORBIDDEN');
            const a = actionSchema.parse(body.value);
            a.closed_at = a.status === 'Clôturée' ? new Date().toISOString() : null;
            await putRecord('action', a.id, a, auth.role);
        }
        else if (body.kind === 'settings') {
            if (auth.role !== 'entry')
                throw new Error('FORBIDDEN');
            const s = z.object({ planUrl: z.string().max(2800000).optional().refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v), 'Format du plan invalide.'), planName: z.string().max(180).optional(), green: z.number().min(0).max(100), yellow: z.number().min(0).max(100), metricApproved: z.boolean() }).parse(body.value);
            if (s.yellow >= s.green)
                throw new Error('Le seuil jaune doit être inférieur au seuil vert.');
            await putRecord('settings', 'main', s, auth.role);
        }
        else
            throw new Error('Opération inconnue.');
        return Response.json({ ok: true });
    }
    catch (error) {
        return failure(error);
    }
}
