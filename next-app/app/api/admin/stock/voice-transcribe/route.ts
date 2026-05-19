// ─── POST /api/admin/stock/voice-transcribe ───────────────────────────
// Whisper fallback for browsers without window.SpeechRecognition
// (notably Firefox). Receives a single audio blob via multipart form,
// proxies it to OpenAI's Whisper API, returns the transcript so the
// client can feed the existing /voice-parse step.
//
// Stateless from an app standpoint — no DB writes here. Auth-gated to
// admin only so we don't accidentally expose OpenAI usage to randoms.

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/utils/supabase/server';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
const MAX_BYTES = 24 * 1024 * 1024; // Whisper's hard limit is 25 MB; stay under.
const ALLOWED_TYPES = new Set([
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/m4a',
    'audio/x-m4a'
]);

export const maxDuration = 60;
// Default body limit on Next route handlers is small; allow larger
// audio blobs explicitly.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    // Auth
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL)
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });

    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
            {
                error:
                    'OPENAI_API_KEY no configurada. La transcripción por Whisper requiere esta variable.'
            },
            { status: 500 }
        );
    }

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'formato inválido' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: 'no se recibió archivo de audio' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json(
            { error: `audio supera ${Math.round(MAX_BYTES / 1024 / 1024)} MB` },
            { status: 413 }
        );
    }
    // type can be missing on Safari; accept blobs with empty type if size
    // looks reasonable, but reject totally foreign MIME types.
    if (file.type && !ALLOWED_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json(
            { error: `formato de audio no soportado: ${file.type}` },
            { status: 415 }
        );
    }

    const language = String(form.get('lang') || 'es');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        const result = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            language, // ISO-639-1 short code (es / en / pt …)
            response_format: 'json'
        });
        const transcript = String(result.text ?? '').trim();
        return NextResponse.json({ transcript });
    } catch (e) {
        console.error('voice-transcribe whisper error', e);
        return NextResponse.json(
            { error: 'error en el servicio de transcripción.' },
            { status: 502 }
        );
    }
}
