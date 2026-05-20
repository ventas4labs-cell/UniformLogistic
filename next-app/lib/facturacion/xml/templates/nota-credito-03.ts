// ─── Nota de Crédito Electrónica (03) — CR v4.4 ──────────────────────
// Identical structure to Factura (01) but with the NotaCreditoElectronica
// root + the nc namespace. InformacionReferencia is REQUIRED and points
// at the original document being credited.

import type { DocumentoElectronico } from '../../types';
import { XML_NAMESPACES } from '../../constants';
import {
    esc,
    buildEmisor,
    buildReceptor,
    buildCondicionVenta,
    buildDetalleServicio,
    buildOtrosCargos,
    buildResumenFactura,
    buildInformacionReferencia,
    buildSignaturePlaceholder
} from './helpers';

export function buildNotaCreditoElectronica(doc: DocumentoElectronico): string {
    if (!doc.informacion_referencia && !doc.referencia) {
        throw new Error(
            'Nota de Crédito requiere InformacionReferencia apuntando al documento original.'
        );
    }
    // Normalize: helpers.ts already accepts `informacion_referencia`;
    // older callers may pass `referencia` for the same purpose.
    const ref = doc.informacion_referencia ?? {
        tipo_doc: doc.referencia!.tipo_doc,
        numero: doc.referencia!.numero,
        fecha_emision: doc.referencia!.fecha_emision,
        codigo: doc.referencia!.codigo,
        razon: doc.referencia!.razon
    };

    return (
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<NotaCreditoElectronica xmlns="${XML_NAMESPACES.nc}">` +
        `<Clave>${esc(doc.clave)}</Clave>` +
        `<ProveedorSistemas>4labs</ProveedorSistemas>` +
        `<CodigoActividadEmisor>${esc(doc.codigo_actividad)}</CodigoActividadEmisor>` +
        `<NumeroConsecutivo>${esc(doc.consecutivo)}</NumeroConsecutivo>` +
        `<FechaEmision>${esc(doc.fecha_emision)}</FechaEmision>` +
        buildEmisor(doc.emisor) +
        buildReceptor(doc.receptor) +
        buildCondicionVenta(doc) +
        buildDetalleServicio(doc.lineas) +
        buildOtrosCargos(doc) +
        buildResumenFactura(doc.resumen, doc) +
        buildInformacionReferencia(ref) +
        buildSignaturePlaceholder() +
        `</NotaCreditoElectronica>`
    );
}
