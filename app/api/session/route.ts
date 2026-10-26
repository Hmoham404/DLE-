import { cookies } from 'next/headers';
import { login, session, failure, checkOrigin } from '@/lib/server';
const attempts = new Map<string, {
    count: number;
    until: number;
}>();
export async function GET() { return Response.json({ session: await session() }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: Request) {
    try {
        checkOrigin(request);
        const key = request.headers.get('cf-connecting-ip') || request.headers.get('oai-authenticated-user-id') || 'local';
        const now = Date.now();
        const a = attempts.get(key);
        if (a && a.until > now && a.count >= 8)
            return Response.json({ error: 'Trop d’essais. Réessayez dans 15 minutes.' }, { status: 429 });
        const { code } = await request.json() as {
            code: unknown;
        };
        if (typeof code !== 'string' || code.length > 100)
            throw new Error('Code invalide.');
        try {
            const result = await login(code.trim());
            attempts.delete(key);
            return Response.json(result);
        }
        catch (error) {
            attempts.set(key, { count: a && a.until > now ? a.count + 1 : 1, until: a && a.until > now ? a.until : now + 900000 });
            throw error;
        }
    }
    catch (error) {
        return failure(error);
    }
}
export async function DELETE(request: Request) { try {
    checkOrigin(request);
    (await cookies()).delete('myc_session');
    return Response.json({ ok: true });
}
catch (error) {
    return failure(error);
} }
