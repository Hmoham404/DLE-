import {prepareReportForExcel} from '@/lib/excel-autofill';
import { authorize, loadState, putRecord, deleteReport, machineSchema, actionSchema, parseReport, failure, checkOrigin } from '@/lib/server';
import { z } from 'zod';
import {productStandardSchema} from '@/lib/product-standards';
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
        if (body.kind === 'product') {
            if (auth.role !== 'entry' && !auth.automatic) throw new Error('FORBIDDEN');
            const product=productStandardSchema.parse(body.value);
            const state=await loadState();
            if(state.products?.some(item=>item.id!==product.id&&item.department===product.department&&item.reference.toLowerCase()===product.reference.toLowerCase()))throw new Error('Cette référence existe déjà dans cet atelier.');
            const {updated_at,...value}=product;
            if(state.products?.some(item=>item.id===product.id)&&!updated_at)throw new Error('Rechargez le référentiel avant de modifier cette référence.');
            await putRecord('product',product.id,value,auth.role,updated_at);
        }
        else if (body.kind === 'machine') {
            if (auth.role !== 'entry' && !auth.automatic)
                throw new Error('FORBIDDEN');
            const m = machineSchema.parse(body.value);
            const state = await loadState();
            if (state.machines.some(x => x.id !== m.id && x.department === m.department && x.name.toLowerCase() === m.name.toLowerCase()))
                throw new Error('Ce nom de machine existe déjà dans cet atelier.');
            await putRecord('machine', m.id, m, auth.role);
        }
        else if (body.kind === 'report') {
            if (auth.role !== 'entry' && !auth.automatic)
                throw new Error('FORBIDDEN');
            const r = parseReport(body.value);
            const state = await loadState();
            if (!state.machines.some(m => m.id === r.machine_id && m.department === r.department))
                throw new Error('Choisissez une machine du département.');
            const prepared=prepareReportForExcel(r,state.machines.find(machine=>machine.id===r.machine_id),state.reports);
            await putRecord('report', r.id, prepared, auth.role, r.updated_at);
        }
        else if (body.kind === 'action') {
            if (auth.role !== 'meeting' && !auth.automatic)
                throw new Error('FORBIDDEN');
            const a = actionSchema.parse(body.value);
            a.closed_at = a.status === 'Clôturée' ? new Date().toISOString() : null;
            await putRecord('action', a.id, a, auth.automatic?'meeting':auth.role);
        }
        else if (body.kind === 'settings') {
            if (auth.role !== 'entry' && !auth.automatic)
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

export async function DELETE(request:Request){
 try{
  checkOrigin(request);
  const auth=await authorize(['entry']);
  const input=z.object({kind:z.literal('report'),id:z.string().uuid(),updated_at:z.string().datetime()}).parse(await request.json());
  await deleteReport(input.id,input.updated_at,auth.role);
  return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return failure(error);}
}
