// ─── Mensaje Receptor (10) — CR v4.4 ──────────────────────────────────
// You acknowledge a supplier's factura within 8 days. The mensaje is its
// own signed e-document, so it gets its own clave + consecutivo + XAdES
// signature like any other.
//
// We piggyback on the standard DocumentoElectronico shape but interpret
// fields differently:
//   doc.emisor     → YOU (your fe_config)
//   doc.receptor   → SUPPLIER (the original document's emisor)
//   doc.informacion_referencia.numero        → supplier's clave
//   doc.informacion_referencia.fecha_emision → supplier's FechaEmision
//   doc.informacion_referencia.codigo        → '1'/'2'/'3' (msg code)
//   doc.informacion_referencia.razon         → DetalleMensaje text
//   doc.resumen.total_impuesto      → MontoTotalImpuesto
//   doc.resumen.total_comprobante   → TotalFactura
//   doc.codigo_actividad            → CodigoActividad
// CondicionImpuesto + MontoTotalImpuestoAcreditar are computed below.

import type { DocumentoElectronico } from '../../types';
import { XML_NAMESPACES } from '../../constants';
import { esc, buildSignaturePlaceholder } from './helpers';

export function buildMensajeReceptor(doc: DocumentoElectronico): string {
    if (!doc.informacion_referencia) {
        throw new Error(
            'Mensaje Receptor requiere informacion_referencia (clave + fecha + código del documento original).'
        );
    }
    if (!doc.receptor) {
        throw new Error('Mensaje Receptor requiere receptor (emisor del documento original).');
    }
    const ref = doc.informacion_referencia;
    const detalle = ref.razon || 'Documento recibido';
    const codigoMsg = ref.codigo || '1';
    const totalImpuesto = doc.resumen.total_impuesto;
    const totalFactura = doc.resumen.total_comprobante;
    // Crediting policy: full credit by default ('01' = condiciones generales,
    // 100% acreditable). F5 may surface this in the UI.
    const condicionImpuesto = '01';
    const totalImpuestoAcreditar = totalImpuesto;

    return (
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<MensajeReceptor xmlns="${XML_NAMESPACES.mr}">` +
        `<Clave>${esc(ref.numero)}</Clave>` +
        `<NumeroCedulaEmisor>${esc(doc.receptor.numero_identificacion)}</NumeroCedulaEmisor>` +
        `<FechaEmisionDoc>${esc(ref.fecha_emision)}</FechaEmisionDoc>` +
        `<Mensaje>${esc(codigoMsg)}</Mensaje>` +
        `<DetalleMensaje>${esc(detalle)}</DetalleMensaje>` +
        `<MontoTotalImpuesto>${totalImpuesto.toFixed(2)}</MontoTotalImpuesto>` +
        `<CodigoActividad>${esc(doc.codigo_actividad)}</CodigoActividad>` +
        `<CondicionImpuesto>${condicionImpuesto}</CondicionImpuesto>` +
        `<MontoTotalImpuestoAcreditar>${totalImpuestoAcreditar.toFixed(2)}</MontoTotalImpuestoAcreditar>` +
        `<TotalFactura>${totalFactura.toFixed(2)}</TotalFactura>` +
        `<NumeroCedulaReceptor>${esc(doc.emisor.numero_identificacion)}</NumeroCedulaReceptor>` +
        `<NumeroConsecutivoReceptor>${esc(doc.consecutivo)}</NumeroConsecutivoReceptor>` +
        buildSignaturePlaceholder() +
        `</MensajeReceptor>`
    );
}
