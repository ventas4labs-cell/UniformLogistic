// ─── Nota de Débito Electrónica (02) — CR v4.4 ───────────────────────
// Same shape as Factura/NotaCrédito with the nd namespace.
// InformacionReferencia is REQUIRED.

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

export function buildNotaDebitoElectronica(doc: DocumentoElectronico): string {
    if (!doc.informacion_referencia && !doc.referencia) {
        throw new Error(
            'Nota de Débito requiere InformacionReferencia apuntando al documento original.'
        );
    }
    const ref = doc.informacion_referencia ?? {
        tipo_doc: doc.referencia!.tipo_doc,
        numero: doc.referencia!.numero,
        fecha_emision: doc.referencia!.fecha_emision,
        codigo: doc.referencia!.codigo,
        razon: doc.referencia!.razon
    };

    return (
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<NotaDebitoElectronica xmlns="${XML_NAMESPACES.nd}">` +
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
        `</NotaDebitoElectronica>`
    );
}
