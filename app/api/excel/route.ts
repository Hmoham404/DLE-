import { authorize, loadState, failure, checkOrigin, runtime } from '@/lib/server';
import { exportWorkbook, importWorkbook, sourceBytes } from '@/lib/excel';
export async function GET(request: Request) {
    try {
        await authorize();
        const p = new URL(request.url).searchParams, department = p.get('department') || '', date = p.get('date') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
            throw new Error('Date invalide.');
        let bytes: Uint8Array;
        if (p.get('blank') === '1')
            bytes = sourceBytes(department);
        else {
            const reports = (await loadState()).reports.filter(r => r.department === department && r.date === date && r.status === 'validated').sort((a, b) => a.shift.localeCompare(b.shift) || a.machine_id.localeCompare(b.machine_id));
            if (!reports.length)
                throw new Error('Aucun rapport validé pour cette date.');
            const config = runtime();
            if (config.EXCEL_SERVICE_URL) {
                if (!config.EXCEL_SERVICE_TOKEN)
                    throw new Error('Le jeton du service Excel est manquant.');
                const url = new URL('/export', config.EXCEL_SERVICE_URL);
                if (url.protocol !== 'https:')
                    throw new Error('Le service Excel doit utiliser HTTPS.');
                const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + config.EXCEL_SERVICE_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ department, reports }), signal: AbortSignal.timeout(30000) });
                if (!r.ok)
                    throw new Error('Le service Python Excel a refusé l’export.');
                bytes = new Uint8Array(await r.arrayBuffer());
            }
            else
                bytes = exportWorkbook(department, reports);
        }
        return new Response(bytes as BodyInit, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="MYC_${department}_${date}.xlsx"`, 'Cache-Control': 'no-store' } });
    }
    catch (error) {
        return failure(error);
    }
}
export async function POST(request: Request) { try {
    checkOrigin(request);
    await authorize(['entry']);
    const form = await request.formData(), file = form.get('file'), department = String(form.get('department') || ''), date = String(form.get('date') || ''), shift = String(form.get('shift') || '');
    if (!(file instanceof File) || file.size > 5000000)
        throw new Error('Fichier XLSX invalide ou trop volumineux.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !shift)
        throw new Error('Sélectionnez une date et une équipe.');
    return Response.json({ rows: importWorkbook(department, new Uint8Array(await file.arrayBuffer()), date, shift) });
}
catch (error) {
    return failure(error);
} }
