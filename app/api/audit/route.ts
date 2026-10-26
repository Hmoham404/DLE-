import { authorize, reportVersions, failure } from '@/lib/server';
export async function GET(request: Request) { try {
    await authorize();
    const id = new URL(request.url).searchParams.get('id') || '';
    return Response.json({ versions: await reportVersions(id) }, { headers: { 'Cache-Control': 'no-store' } });
}
catch (error) {
    return failure(error);
} }
