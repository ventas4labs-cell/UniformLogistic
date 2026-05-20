// ─── /api/admin/facturacion/recibidas ─────────────────────────────────
// GET — list inbound supplier invoices (paginated by limit).
// POST — upload a supplier XML to register a new inbound invoice. The
//        body can be either a `multipart/form-data` with a `file` field
//        or JSON `{ xml: string, branch_id?: uuid }`. Parses with
//        xml-parser-service, persists fe_facturas_recibidas +
//        fe_lineas_recibidas. Idempotent on clave.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { parseInboundXml } from '@/lib/facturacion/services/xml-parser-service';
import { DEFAULT_BRANCH_ID } from '@/lib/services/feConfig';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';
export const maxDuration = 30;
export const runtime = 'nodejs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feFrom = (s: ReturnType<typeof createAdminClient>, t: string): any =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s as unknown as any).from(t);

async function adminGate(req: NextRequest): Promise<NextResponse | null> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
    if ((user.email || '').trim().toLowerCase() !== ADMIN_EMAIL)
        return NextResponse.json({ error: 'sólo admin' }, { status: 403 });
    return null;
}

export async function GET(req: NextRequest) {
    const blocked = await adminGate(req);
    if (blocked) return blocked;

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
    const estado = url.searchParams.get('estado');
    const admin = createAdminClient();

    let q = feFrom(admin, 'fe_facturas_recibidas')
        .select(
            'id, clave, consecutivo, tipo_documento, fecha_emision, emisor_cedula, emisor_nombre, total_comprobante, estado_acuse, received_at, ack_deadline, mensaje_receptor_id'
        )
        .order('received_at', { ascending: false })
        .limit(limit);
    if (estado) q = q.eq('estado_acuse', estado);

    const { data, error } = await q;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ recibidas: data || [] });
}

export async function POST(req: NextRequest) {
    const blocked = await adminGate(req);
    if (blocked) return blocked;

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    let xml = '';
    let branchId = DEFAULT_BRANCH_ID;

    try {
        if (contentType.includes('multipart/form-data')) {
            const form = await req.formData();
            const file = form.get('file');
            if (!(file instanceof File) || file.size === 0) {
                return NextResponse.json({ error: 'archivo XML requerido' }, { status: 400 });
            }
            xml = await file.text();
            const bid = form.get('branch_id');
            if (typeof bid === 'string' && bid) branchId = bid;
        } else {
            const body = (await req.json()) as { xml?: string; branch_id?: string };
            if (!body.xml) {
                return NextResponse.json({ error: 'xml requerido' }, { status: 400 });
            }
            xml = body.xml;
            if (body.branch_id) branchId = body.branch_id;
        }
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'cuerpo inválido' },
            { status: 400 }
        );
    }

    let parsed;
    try {
        parsed = parseInboundXml(xml);
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'no se pudo parsear XML' },
            { status: 422 }
        );
    }

    const admin = createAdminClient();
    const { data: existing } = await feFrom(admin, 'fe_facturas_recibidas')
        .select('id')
        .eq('clave', parsed.clave)
        .maybeSingle();
    if (existing) {
        return NextResponse.json(
            { ok: true, id: existing.id, deduplicated: true },
            { status: 200 }
        );
    }

    const { data: inserted, error: insertErr } = await feFrom(admin, 'fe_facturas_recibidas')
        .insert({
            branch_id: branchId,
            clave: parsed.clave,
            consecutivo: parsed.consecutivo,
            tipo_documento: parsed.tipo_documento,
            fecha_emision: parsed.fecha_emision,
            emisor_cedula: parsed.emisor_cedula,
            emisor_nombre: parsed.emisor_nombre,
            receptor_cedula: parsed.receptor_cedula,
            receptor_nombre: parsed.receptor_nombre,
            total_venta: parsed.total_venta,
            total_descuentos: parsed.total_descuentos,
            total_impuesto: parsed.total_impuesto,
            total_comprobante: parsed.total_comprobante,
            xml_original: xml
        })
        .select('id')
        .single();
    if (insertErr || !inserted) {
        return NextResponse.json(
            { error: insertErr?.message || 'inserción falló' },
            { status: 500 }
        );
    }

    if (parsed.lineas.length > 0) {
        const lineRows = parsed.lineas.map((l) => ({
            factura_id: inserted.id,
            numero_linea: l.numero_linea,
            codigo_cabys: l.codigo_cabys,
            detalle: l.detalle,
            cantidad: l.cantidad,
            unidad_medida: l.unidad_medida,
            precio_unitario: l.precio_unitario,
            subtotal: l.subtotal,
            monto_impuesto: l.monto_impuesto,
            monto_total_linea: l.monto_total_linea
        }));
        const { error: linesErr } = await feFrom(admin, 'fe_lineas_recibidas').insert(
            lineRows
        );
        if (linesErr) {
            console.error('[FE recibidas] insert lines failed:', linesErr);
        }
    }

    return NextResponse.json({ ok: true, id: inserted.id, clave: parsed.clave });
}
