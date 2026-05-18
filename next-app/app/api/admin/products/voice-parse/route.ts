// ─── POST /api/admin/products/voice-parse ─────────────────────────────
// Single-shot extraction: takes a Spanish transcript describing a new
// product, returns the fields that map to the existing ProductInput
// shape from lib/services/products.ts. The client prefills the existing
// "Nuevo Producto" form with these — no auto-create, the admin still
// reviews & saves through createProductAction.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';
import { validateCABYS } from '@/lib/facturacion/validation/cabys-validator';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
const MAX_TRANSCRIPT_LEN = 1500;
const MAX_TOKENS = 1024;
export const maxDuration = 30;

// Output shape — fields mirror ProductInput from lib/services/products.ts.
// Everything is nullable so partial dictations work (admin can finish
// typing into the existing form).
interface ParsedProduct {
    name: string | null;
    description: string | null;
    productType: 'shirt' | 'pant' | null;
    gender: 'men' | 'women' | 'unisex' | null;
    sizes_men: string[] | null;
    sizes_women: string[] | null;
    sizes_waist: number[] | null;
    sizes_inseam: number[] | null;
    fabricType: string | null;
    codigoCabys: string | null;
    unitPrice: number | null;
    confidence: number;
}

interface LLMToolInput {
    name?: string | null;
    description?: string | null;
    productType?: 'shirt' | 'pant' | null;
    gender?: 'men' | 'women' | 'unisex' | null;
    sizes_men?: string[] | null;
    sizes_women?: string[] | null;
    sizes_waist?: number[] | null;
    sizes_inseam?: number[] | null;
    fabricType?: string | null;
    codigoCabys?: string | null;
    unitPrice?: number | null;
    confidence?: number;
}

export async function POST(req: NextRequest) {
    let body: { transcript?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const transcript = (body.transcript || '').trim();
    if (!transcript) return NextResponse.json({ error: 'transcripción vacía' }, { status: 400 });
    if (transcript.length > MAX_TRANSCRIPT_LEN)
        return NextResponse.json(
            { error: `transcripción supera ${MAX_TRANSCRIPT_LEN} caracteres` },
            { status: 413 }
        );

    // Auth
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL)
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });

    if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json(
            { error: 'ANTHROPIC_API_KEY no configurada en el servidor' },
            { status: 500 }
        );
    }

    const tool: Anthropic.Tool = {
        name: 'crear_producto_desde_voz',
        description:
            'Extrae los campos de un producto nuevo de uniforme a partir de un dictado en español. ' +
            'Para CADA campo: si el usuario lo mencionó, devolvé el valor; si no, devolvé null. NO inventes valores.',
        input_schema: {
            type: 'object',
            properties: {
                name: { type: ['string', 'null'] },
                description: { type: ['string', 'null'] },
                productType: { type: ['string', 'null'], enum: ['shirt', 'pant', null] },
                gender: { type: ['string', 'null'], enum: ['men', 'women', 'unisex', null] },
                sizes_men: {
                    type: ['array', 'null'],
                    items: { type: 'string' },
                    description:
                        'Tallas para hombre (camisa). Expandí rangos: "S a XL" → ["S","M","L","XL"].'
                },
                sizes_women: {
                    type: ['array', 'null'],
                    items: { type: 'string' },
                    description: 'Tallas para mujer (camisa). Mismas reglas de expansión.'
                },
                sizes_waist: {
                    type: ['array', 'null'],
                    items: { type: 'number' },
                    description:
                        'Cinturas para pantalón. "28 a 38 de dos en dos" → [28,30,32,34,36,38].'
                },
                sizes_inseam: {
                    type: ['array', 'null'],
                    items: { type: 'number' },
                    description: 'Largos (inseam) para pantalón si se mencionan.'
                },
                fabricType: { type: ['string', 'null'] },
                codigoCabys: {
                    type: ['string', 'null'],
                    description:
                        '13 dígitos exactos. Concatená los dígitos dictados. Si no llega a 13, devolvé null.'
                },
                unitPrice: {
                    type: ['number', 'null'],
                    description: 'En colones costarricenses. "doce mil" → 12000.'
                },
                confidence: { type: 'number' }
            },
            required: [
                'name',
                'description',
                'productType',
                'gender',
                'sizes_men',
                'sizes_women',
                'sizes_waist',
                'sizes_inseam',
                'fabricType',
                'codigoCabys',
                'unitPrice',
                'confidence'
            ]
        }
    };

    const systemPrompt = `Eres un asistente que extrae los datos de un producto nuevo de uniformes a partir de un dictado en español de Costa Rica.

Reglas:
- Para cada campo, si el usuario lo dijo, devolvé el valor; si NO lo dijo, devolvé null.
- NO inventes valores. NO asumas. NO completes campos con defaults plausibles.
- productType: "camisa", "polo", "jacket", "chaqueta" → "shirt". "pantalón", "cargo", "docker", "jeans" → "pant".
- gender: "hombre" → "men", "mujer" → "women", "unisex" → "unisex". Si no se menciona, null.
- Tallas alfa: convertí palabras a códigos cortos. "mediana" → "M", "extra grande" → "XL", "doble extra grande" → "2XL", "triple extra grande" → "3XL".
- Rangos: "S a XL" → ["S","M","L","XL"] (progresión XS,S,M,L,XL,2XL,3XL,4XL,5XL).
- Pantalones: "cintura 32" → sizes_waist=[32]. "cintura 28 a 38 de dos en dos" → [28,30,32,34,36,38].
- Si el producto es camisa, sizes_waist y sizes_inseam deben ser null.
- Si el producto es pantalón, sizes_men y sizes_women deben ser null.
- "gender=unisex" con tallas alfa: poblá sizes_men con esas tallas y dejá sizes_women null (el admin decidirá si replicar).
- CABYS: el usuario suele dictar dígito por dígito ("seis dos cero uno cero cero cero cero cero cero cero cero cero"). Concatená los 13 dígitos. Si lo que escuchaste no son exactamente 13 dígitos, devolvé null.
- unitPrice en colones. "doce mil quinientos" → 12500. "mil dólares" → null (no convertir monedas).
- description sólo si el usuario lo dijo explícitamente.
- confidence: 0–1. Bajá a 0.6 si hay ambigüedad fuerte (p.ej. tipo de tela inferido por contexto).`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let resp: Anthropic.Message;
    try {
        resp = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            tools: [tool],
            tool_choice: { type: 'tool', name: 'crear_producto_desde_voz' },
            messages: [{ role: 'user', content: `Transcripción: "${transcript}"` }]
        });
    } catch (e) {
        console.error('voice-parse-product anthropic error', e);
        return NextResponse.json(
            { error: 'error al contactar el LLM. Intentá de nuevo.' },
            { status: 502 }
        );
    }

    const toolUse = resp.content.find((b) => b.type === 'tool_use');
    const args =
        toolUse && toolUse.type === 'tool_use'
            ? (toolUse.input as LLMToolInput)
            : ({} as LLMToolInput);

    // Server-side sanitization. Each field either passes through or is
    // forced back to null.
    const allowedType = args.productType === 'shirt' || args.productType === 'pant'
        ? args.productType
        : null;
    const allowedGender =
        args.gender === 'men' || args.gender === 'women' || args.gender === 'unisex'
            ? args.gender
            : null;

    // Sizes must match product_type. Clamp the irrelevant ones to null.
    let sizes_men: string[] | null = null;
    let sizes_women: string[] | null = null;
    let sizes_waist: number[] | null = null;
    let sizes_inseam: number[] | null = null;
    if (allowedType === 'shirt') {
        sizes_men = Array.isArray(args.sizes_men)
            ? args.sizes_men.map(String).filter(Boolean).slice(0, 20)
            : null;
        sizes_women = Array.isArray(args.sizes_women)
            ? args.sizes_women.map(String).filter(Boolean).slice(0, 20)
            : null;
    } else if (allowedType === 'pant') {
        sizes_waist = Array.isArray(args.sizes_waist)
            ? args.sizes_waist.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 20)
            : null;
        sizes_inseam = Array.isArray(args.sizes_inseam)
            ? args.sizes_inseam.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 20)
            : null;
    }

    // CABYS: enforce the existing validator. Reject anything that's not
    // a clean 13-digit non-zero string.
    let codigoCabys: string | null = null;
    if (typeof args.codigoCabys === 'string' && args.codigoCabys.trim()) {
        const cleaned = args.codigoCabys.replace(/\D/g, '');
        if (validateCABYS(cleaned).valid) codigoCabys = cleaned;
    }

    const unitPrice =
        typeof args.unitPrice === 'number' && Number.isFinite(args.unitPrice) && args.unitPrice >= 0
            ? Math.round(args.unitPrice * 100) / 100
            : null;

    const product: ParsedProduct = {
        name: typeof args.name === 'string' ? args.name.trim().slice(0, 120) || null : null,
        description:
            typeof args.description === 'string'
                ? args.description.trim().slice(0, 500) || null
                : null,
        productType: allowedType,
        gender: allowedGender,
        sizes_men,
        sizes_women,
        sizes_waist,
        sizes_inseam,
        fabricType:
            typeof args.fabricType === 'string'
                ? args.fabricType.trim().slice(0, 80) || null
                : null,
        codigoCabys,
        unitPrice,
        confidence: Math.max(0, Math.min(1, Number(args.confidence ?? 0.7)))
    };

    // Best-effort audit row. If this insert fails we still return the
    // parsed payload — the failure is in observability only.
    await supabase
        .from('voice_product_drafts')
        .insert({
            user_id: user.id,
            transcript,
            parsed_product: product as unknown as Record<string, unknown>
        })
        .then((res) => {
            if (res.error) console.error('voice_product_drafts insert failed', res.error);
        });

    return NextResponse.json({ transcript, product });
}
