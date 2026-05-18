// ─── POST /api/admin/stock/voice-parse ────────────────────────────────
// Takes a Spanish transcript + company_id, asks Claude (forced tool call)
// to extract entry-type stock movements that reference exact catalog
// SKUs, then defense-in-depth filters anything the LLM returned that
// doesn't match the company's catalog.

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';
import {
    buildVoiceCatalog,
    formatCatalogLine,
    type VoiceCatalogEntry
} from '@/lib/services/voice-catalog';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
const MAX_TRANSCRIPT_LEN = 2000;
const MAX_TOKENS = 2048;

// Allow up to 30 s for the LLM round-trip on large catalogs. Fluid
// Compute will scale concurrency on its own; we just need the upper
// bound generous enough.
export const maxDuration = 30;

type MovementType = 'entry' | 'exit' | 'reserve' | 'release' | 'adjustment';

const VALID_TYPES: MovementType[] = [
    'entry',
    'exit',
    'reserve',
    'release',
    'adjustment'
];

interface ParsedCommand {
    product_id: string;
    product_name: string;
    product_code: string;
    size: string;
    company_stock_id: string | null;
    type: MovementType;
    quantity: number;
    reason: string;
    confidence: number;
}

interface UnmatchedMention {
    raw: string;
    quantity: number | null;
    unit: string | null;
}

interface LLMToolInput {
    commands?: Array<{
        product_id?: string;
        size?: string;
        quantity?: number;
        type?: string;
        reason?: string;
        confidence?: number;
    }>;
    unmatched?: Array<{
        raw?: string;
        quantity?: number | null;
        unit?: string | null;
    }>;
}

export async function POST(req: NextRequest) {
    let body: { transcript?: string; company_id?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }
    const transcript = (body.transcript || '').trim();
    const companyId = body.company_id;

    if (!transcript) return NextResponse.json({ error: 'transcripción vacía' }, { status: 400 });
    if (transcript.length > MAX_TRANSCRIPT_LEN)
        return NextResponse.json(
            { error: `transcripción supera ${MAX_TRANSCRIPT_LEN} caracteres` },
            { status: 413 }
        );
    if (!companyId)
        return NextResponse.json({ error: 'company_id requerido' }, { status: 400 });

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

    // Catalog this company is allowed to receive into.
    let catalog: VoiceCatalogEntry[];
    try {
        catalog = await buildVoiceCatalog(supabase, companyId);
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'error cargando catálogo' },
            { status: 500 }
        );
    }
    if (catalog.length === 0) {
        return NextResponse.json({
            transcript,
            commands: [],
            unmatched: [],
            warning:
                'Esta empresa no tiene productos asignados. Asignalos en /admin/catalog antes de dictar stock.'
        });
    }

    const catalogLines = catalog
        .map((c, i) => formatCatalogLine(c, i))
        .join('\n');

    const tool: Anthropic.Tool = {
        name: 'registrar_movimientos_stock',
        description:
            'Registra movimientos de stock derivados del dictado. Cada movimiento DEBE referenciar un product_id EXACTO del catálogo y usar UNA de las tallas listadas para ese producto. NO inventes UUIDs ni tallas.',
        input_schema: {
            type: 'object',
            properties: {
                commands: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            product_id: {
                                type: 'string',
                                description: 'UUID exacto del catálogo'
                            },
                            size: {
                                type: 'string',
                                description:
                                    'Cadena exacta de la talla tal como aparece en el catálogo para ese producto'
                            },
                            quantity: {
                                type: 'number',
                                description:
                                    'Para entry/exit/reserve/release es la cantidad afectada. Para adjustment es el TOTAL final que el conteo físico arroja.'
                            },
                            type: {
                                type: 'string',
                                enum: ['entry', 'exit', 'reserve', 'release', 'adjustment'],
                                description:
                                    'entry=recepción, exit=salida/despacho, reserve=bloquear stock para una orden, release=liberar reserva, adjustment=corrección por conteo físico (quantity es el TOTAL final)'
                            },
                            reason: { type: 'string' },
                            confidence: { type: 'number' }
                        },
                        required: [
                            'product_id',
                            'size',
                            'quantity',
                            'type',
                            'reason',
                            'confidence'
                        ]
                    }
                },
                unmatched: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            raw: { type: 'string' },
                            quantity: { type: ['number', 'null'] },
                            unit: { type: ['string', 'null'] }
                        },
                        required: ['raw']
                    }
                }
            },
            required: ['commands', 'unmatched']
        }
    };

    const systemPrompt = `Eres un asistente que extrae movimientos de stock de uniformes a partir de transcripciones de voz en español de Costa Rica.

Reglas estrictas:
- Sólo usás product_id que aparezcan EXACTAMENTE en el catálogo de abajo.
- Para la talla, copiá UNA de las cadenas exactas listadas para ese producto. No inventes tallas nuevas.
- Convertí números escritos en palabras a dígitos ("veinte" → 20, "tres docenas" → 36, "una docena y media" → 18).

Detección de TIPO de movimiento (mapeá el verbo dictado a uno de los enums):
- **entry** (recepción): "recibí", "llegó", "llegaron", "ingresó", "ingresaron", "agregar", "sumar", "entró", "entraron", "metí", "metieron al stock".
- **exit** (despacho / merma): "saqué", "salió", "salieron", "despaché", "vendí", "entregué", "entregamos", "se mermó", "se perdió", "se dañó", "descarté".
- **reserve** (bloquear stock para una orden): "reservé", "reservar", "aparté", "separé", "comprometí", "bloquear para".
- **release** (liberar una reserva): "liberé", "devolví al stock disponible", "cancelar reserva", "liberar".
- **adjustment** (corrección por conteo físico — el 'quantity' es el TOTAL FINAL, no un delta): "el conteo dice", "el conteo arroja", "conté X y son", "el inventario físico es", "ajustar a", "corregir a", "en bodega hay realmente", "el conteo cierra en".

Tallas canónicas:
- "hombre talla M" → "H · M"
- "mujer XL" → "M · XL"
- "cintura 32" → "C32\\""
- "cintura 34 largo 30" → "C34\\" / L30\\""
- "mediana" → M, "grande" → L, "extra grande" → XL, "doble extra grande" → 2XL, "triple extra grande" → 3XL.

Reglas adicionales:
- Si hay ambigüedad de producto ("camisa azul" cuando hay dos azules), elegí el más probable y bajá confidence a 0.6.
- Si el producto/talla NO está en el catálogo, NO inventes nada — ponelo en 'unmatched' con la frase original.
- Si NO podés identificar un tipo claro de movimiento, mové la frase a 'unmatched' antes que asumir 'entry'.
- 'reason' por defecto depende del tipo: "Recepción por voz" (entry), "Despacho por voz" (exit), "Reserva por voz" (reserve), "Liberación de reserva por voz" (release), "Ajuste por conteo físico" (adjustment). Si el usuario especifica un motivo concreto ("factura 4521", "OC numero mil doscientos", "merma por humedad", "conteo del lunes"), usalo en su lugar.

CATÁLOGO DISPONIBLE PARA ESTA EMPRESA:
${catalogLines}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let resp: Anthropic.Message;
    try {
        resp = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            tools: [tool],
            tool_choice: { type: 'tool', name: 'registrar_movimientos_stock' },
            messages: [{ role: 'user', content: `Transcripción: "${transcript}"` }]
        });
    } catch (e) {
        console.error('voice-parse anthropic error', e);
        return NextResponse.json(
            { error: 'error al contactar el LLM. Intentá de nuevo.' },
            { status: 502 }
        );
    }

    const toolUse = resp.content.find((b) => b.type === 'tool_use');
    const args = (toolUse && toolUse.type === 'tool_use'
        ? (toolUse.input as LLMToolInput)
        : { commands: [], unmatched: [] }) as LLMToolInput;

    // Defense in depth: drop anything that doesn't reference a valid
    // (product_id, size) pair from the catalog. The LLM can't introduce
    // foreign UUIDs through this filter.
    const byKey = new Map(catalog.map((c) => [`${c.product_id}|${c.size}`, c]));
    const DEFAULT_REASON: Record<MovementType, string> = {
        entry: 'Recepción por voz',
        exit: 'Despacho por voz',
        reserve: 'Reserva por voz',
        release: 'Liberación de reserva por voz',
        adjustment: 'Ajuste por conteo físico'
    };

    const commands: ParsedCommand[] = (args.commands ?? [])
        .filter((c) => {
            if (!c) return false;
            const type = c.type as MovementType | undefined;
            if (!type || !VALID_TYPES.includes(type)) return false;
            if (!c.product_id || !c.size) return false;
            const entry = byKey.get(`${c.product_id}|${c.size}`);
            if (!entry) return false;
            const q = Number(c.quantity);
            if (!Number.isFinite(q)) return false;
            // Adjustment can target 0 (cleared the bin); the others need > 0.
            if (type === 'adjustment') return q >= 0;
            return q > 0;
        })
        .map((c) => {
            const entry = byKey.get(`${c.product_id}|${c.size}`) as VoiceCatalogEntry;
            const type = c.type as MovementType;
            return {
                product_id: entry.product_id,
                product_name: entry.product_name,
                product_code: entry.product_code,
                size: entry.size,
                company_stock_id: entry.company_stock_id,
                type,
                quantity: Math.floor(Number(c.quantity)),
                reason: String(c.reason ?? DEFAULT_REASON[type]).slice(0, 200),
                confidence: Math.max(0, Math.min(1, Number(c.confidence ?? 0.7)))
            };
        });

    const unmatched: UnmatchedMention[] = (args.unmatched ?? []).map((u) => ({
        raw: String(u.raw ?? '').slice(0, 200),
        quantity: u.quantity != null ? Number(u.quantity) : null,
        unit: u.unit != null ? String(u.unit) : null
    }));

    return NextResponse.json({ transcript, commands, unmatched, warning: null });
}
