// ─── Factura Electrónica (01) — CR v4.4 ───────────────────────────────────
import type { DocumentoElectronico } from "../../types";
import { XML_NAMESPACES } from "../../constants";
import {
  esc,
  buildEmisor,
  buildReceptor,
  buildCondicionVenta,
  buildDetalleServicio,
  buildOtrosCargos,
  buildResumenFactura,
  buildInformacionReferencia,
  buildSignaturePlaceholder,
} from "./helpers";

export function buildFacturaElectronica(doc: DocumentoElectronico): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<FacturaElectronica xmlns="${XML_NAMESPACES.fe}">` +
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
    `</FacturaElectronica>`
  );
}
