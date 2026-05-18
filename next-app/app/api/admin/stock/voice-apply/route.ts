// ─── POST /api/admin/stock/voice-apply ────────────────────────────────
// Receives the (possibly edited) commands the admin confirmed in the
// review modal, re-validates them, then loops the
// upsert_company_stock_movement RPC per command. Partial success is the
// default — failures don't roll back the rest of the batch.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildVoiceCatalog } from '@/lib/services/voice-catalog';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
const MAX_BATCH = 50;

type MovementType = 'entry' | 'exit' | 'reserve' | 'release' | 'adjustment';
const VALID_TYPES: MovementType[] = [
    'entry',
    'exit',
    'reserve',
    'release',
    'adjustment'
];

export const maxDuration = 30;

interface InboundCommand {
    product_id?: string;
    product_name?: string;
    product_code?: string;
    size?: string;
    type?: string;
    quantity?: number;
    reason?: string;
    confidence?: number;
    company_stock_id?: string | null;
}

interface ResultRow {
    product_id: string;
    product_name?: string;
    size: string;
    type: string;
    quantity: number;
    reason: string;
    ok: boolean;
    error?: string;
    company_stock_id?: string;
    new_on_hand?: number;
    new_reserved?: number;
    /** True when an adjustment didn't change anything (target == current). */
    noop?: boolean;
}

export async function POST(req: NextRequest) {
    let body: {
        company_id?: string;
        transcript?: string;
        parsed_commands?: InboundCommand[];
        commands?: InboundCommand[];
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const companyId = body.company_id;
    const transcript = (body.transcript || '').slice(0, 4000);
    const parsedCommands = body.parsed_commands ?? [];
    const commands = body.commands ?? [];

    if (!companyId)
        return NextResponse.json({ error: 'company_id requerido' }, { status: 400 });
    if (!Array.isArray(commands) || commands.length === 0)
        return NextResponse.json({ error: 'sin comandos para aplicar' }, { status: 400 });
    if (commands.length > MAX_BATCH)
        return NextResponse.json(
            { error: `lote demasiado grande (máx ${MAX_BATCH})` },
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

    // Re-validate every command's (product_id, size) belongs to this
    // company's catalog. The client can POST arbitrary UUIDs / sizes;
    // this is the boundary check.
    let catalog;
    try {
        catalog = await buildVoiceCatalog(supabase, companyId);
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'error cargando catálogo' },
            { status: 500 }
        );
    }
    const validKeys = new Set(catalog.map((c) => `${c.product_id}|${c.size}`));

    const results: ResultRow[] = [];

    for (const raw of commands) {
        const requestedType = String(raw.type ?? 'entry') as MovementType;
        const cmd: ResultRow = {
            product_id: String(raw.product_id ?? ''),
            product_name: raw.product_name,
            size: String(raw.size ?? ''),
            type: requestedType,
            quantity: Number(raw.quantity ?? 0),
            reason: String(raw.reason ?? 'Recepción por voz').slice(0, 200),
            ok: false
        };

        if (!cmd.product_id || !cmd.size) {
            results.push({ ...cmd, error: 'producto o talla faltante' });
            continue;
        }
        if (!validKeys.has(`${cmd.product_id}|${cmd.size}`)) {
            results.push({
                ...cmd,
                error: 'producto/talla no asignado a esta empresa'
            });
            continue;
        }
        if (!VALID_TYPES.includes(requestedType)) {
            results.push({ ...cmd, error: `tipo de movimiento inválido: ${requestedType}` });
            continue;
        }
        // Adjustments can set the target to 0 (cleared the bin); everything
        // else requires a positive quantity.
        const qtyValid =
            Number.isInteger(cmd.quantity) &&
            (requestedType === 'adjustment' ? cmd.quantity >= 0 : cmd.quantity > 0);
        if (!qtyValid) {
            results.push({ ...cmd, error: 'cantidad inválida' });
            continue;
        }

        const { data, error } = await supabase.rpc('upsert_company_stock_movement', {
            p_company_id: companyId,
            p_product_id: cmd.product_id,
            p_size: cmd.size,
            p_type: requestedType,
            p_quantity: cmd.quantity,
            p_reason: `🎙 ${cmd.reason}`,
            p_source: 'voice'
        });
        if (error) {
            results.push({ ...cmd, error: error.message });
        } else {
            const payload = data as
                | {
                      ok?: boolean;
                      company_stock_id?: string;
                      on_hand?: number;
                      reserved?: number;
                      noop?: boolean;
                  }
                | null;
            results.push({
                ...cmd,
                ok: true,
                company_stock_id: payload?.company_stock_id,
                new_on_hand: payload?.on_hand,
                new_reserved: payload?.reserved,
                noop: payload?.noop ?? false
            });
        }
    }

    const applied = results.filter((r) => r.ok).length;
    const failed = results.length - applied;

    // Audit log. Best-effort — if this insert fails the movements still
    // landed because each RPC committed its own transaction.
    const { error: auditError } = await supabase.from('voice_stock_batches').insert({
        company_id: companyId,
        user_id: user.id,
        transcript,
        parsed_commands: parsedCommands,
        applied_commands: commands,
        applied_count: applied,
        failed_count: failed
    });
    if (auditError) console.error('voice_stock_batches insert failed', auditError);

    return NextResponse.json({ applied, failed, results });
}
