// ─── Factura Electrónica de Compra (08) — CR v4.4 ────────────────────
// You (registered taxpayer) self-issue an invoice when buying from a
// non-registered seller. Same shape as Factura (01) with the fec namespace.

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

export function buildFacturaElectronicaCompra(doc: DocumentoElectronico): string {
    if (!doc.receptor) {
        throw new Error('Factura de Compra requiere receptor (vendedor no inscrito).');
    }
    return (
        `<?xml version="1.0" encoding="utf-8"?>` +
        `<FacturaElectronicaCompra xmlns="${XML_NAMESPACES.fec}">` +
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
        buildInformacionReferencia(doc.informacion_referencia) +
        buildSignaturePlaceholder() +
        `</FacturaElectronicaCompra>`
    );
}
