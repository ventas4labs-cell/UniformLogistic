// ─── XML Template Helpers — Shared functions for CR e-invoicing v4.4 ──────
import type {
  DocumentoElectronico,
  EmisorReceptor,
  LineaDetalle,
  ResumenFactura,
} from "../../types";

// ─── XML Escaping ─────────────────────────────────────────────────────────
export function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  // Only escape the 3 characters that Exclusive C14N escapes in text content.
  // Do NOT escape " or ' — C14N does not use &quot; or &apos; in text nodes,
  // and doing so would cause a digest mismatch with Hacienda's verification.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Optional tag — only emits when value is truthy ───────────────────────
export function tag(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  return `<${name}>${esc(value)}</${name}>`;
}

// ─── Wrap content in a tag only if content is non-empty ───────────────────
export function wrapTag(name: string, content: string): string {
  if (!content.trim()) return "";
  return `<${name}>${content}</${name}>`;
}

// ─── Emisor / Receptor ────────────────────────────────────────────────────
export function buildIdentificacion(entity: EmisorReceptor): string {
  return `<Identificacion>` +
    `<Tipo>${esc(entity.tipo_identificacion)}</Tipo>` +
    `<Numero>${esc(entity.numero_identificacion)}</Numero>` +
    `</Identificacion>`;
}

/**
 * Pad a numeric code to a given width. v4.4 schema:
 * - Provincia: 1 digit (\d)
 * - Canton: 2 digits (\d{2})
 * - Distrito: 2 digits (\d{2})
 * - Barrio: 2 digits (\d{2})
 */
function padCode(value: string, width: number): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(width, "0");
  }
  return trimmed;
}

export function buildUbicacion(entity: EmisorReceptor): string {
  if (!entity.ubicacion) return "";
  const u = entity.ubicacion;
  return `<Ubicacion>` +
    `<Provincia>${esc(padCode(u.provincia, 1))}</Provincia>` +
    `<Canton>${esc(padCode(u.canton, 2))}</Canton>` +
    `<Distrito>${esc(padCode(u.distrito, 2))}</Distrito>` +
    (u.barrio ? `<Barrio>${esc(padCode(u.barrio, 2))}</Barrio>` : "") +
    (u.otras_senas ? `<OtrasSenas>${esc(u.otras_senas)}</OtrasSenas>` : "") +
    `</Ubicacion>`;
}

export function buildTelefono(entity: EmisorReceptor): string {
  if (!entity.telefono) return "";
  return `<Telefono>` +
    `<CodigoPais>${esc(entity.codigo_pais || "506")}</CodigoPais>` +
    `<NumTelefono>${esc(entity.telefono)}</NumTelefono>` +
    `</Telefono>`;
}

export function buildEmisor(emisor: EmisorReceptor): string {
  return `<Emisor>` +
    `<Nombre>${esc(emisor.nombre)}</Nombre>` +
    buildIdentificacion(emisor) +
    (emisor.nombre_comercial
      ? `<NombreComercial>${esc(emisor.nombre_comercial)}</NombreComercial>`
      : "") +
    buildUbicacion(emisor) +
    buildTelefono(emisor) +
    (emisor.correo
      ? `<CorreoElectronico>${esc(emisor.correo)}</CorreoElectronico>`
      : "") +
    `</Emisor>`;
}

export function buildReceptor(receptor: EmisorReceptor | undefined): string {
  if (!receptor) return "";
  return `<Receptor>` +
    `<Nombre>${esc(receptor.nombre)}</Nombre>` +
    buildIdentificacion(receptor) +
    (receptor.nombre_comercial
      ? `<NombreComercial>${esc(receptor.nombre_comercial)}</NombreComercial>`
      : "") +
    buildUbicacion(receptor) +
    buildTelefono(receptor) +
    (receptor.correo
      ? `<CorreoElectronico>${esc(receptor.correo)}</CorreoElectronico>`
      : "") +
    `</Receptor>`;
}

// ─── Impuesto ─────────────────────────────────────────────────────────────
export function buildImpuesto(linea: LineaDetalle): string {
  if (!linea.impuesto) return "";
  const imp = linea.impuesto;
  let exoneracion = "";
  if (imp.exoneracion) {
    const ex = imp.exoneracion;
    exoneracion = `<Exoneracion>` +
      `<TipoDocumento>${esc(ex.tipo_documento)}</TipoDocumento>` +
      `<NumeroDocumento>${esc(ex.numero_documento)}</NumeroDocumento>` +
      `<NombreInstitucion>${esc(ex.nombre_institucion)}</NombreInstitucion>` +
      `<FechaEmision>${esc(ex.fecha_emision)}</FechaEmision>` +
      `<PorcentajeExoneracion>${esc(ex.porcentaje_exoneracion)}</PorcentajeExoneracion>` +
      `<MontoExoneracion>${esc(ex.monto_exoneracion)}</MontoExoneracion>` +
      `</Exoneracion>`;
  }
  return `<Impuesto>` +
    `<Codigo>${esc(imp.codigo)}</Codigo>` +
    `<CodigoTarifaIVA>${esc(imp.codigo_tarifa)}</CodigoTarifaIVA>` +
    `<Tarifa>${esc(imp.tarifa)}</Tarifa>` +
    (imp.factor_iva !== undefined ? `<FactorCalculoIVA>${esc(imp.factor_iva)}</FactorCalculoIVA>` : "") +
    `<Monto>${esc(imp.monto)}</Monto>` +
    exoneracion +
    `</Impuesto>`;
}

// ─── Línea de Detalle ─────────────────────────────────────────────────────
export function buildLineaDetalle(linea: LineaDetalle): string {
  let codigoComercial = "";
  if (linea.codigo_comercial) {
    codigoComercial = `<CodigoComercial>` +
      `<Tipo>${esc(linea.codigo_comercial.tipo)}</Tipo>` +
      `<Codigo>${esc(linea.codigo_comercial.codigo)}</Codigo>` +
      `</CodigoComercial>`;
  }

  let descuento = "";
  if (linea.descuento) {
    descuento = `<Descuento>` +
      `<MontoDescuento>${esc(linea.descuento.monto)}</MontoDescuento>` +
      `<NaturalezaDescuento>${esc(linea.descuento.naturaleza)}</NaturalezaDescuento>` +
      `</Descuento>`;
  }

  return `<LineaDetalle>` +
    `<NumeroLinea>${esc(linea.numero_linea)}</NumeroLinea>` +
    `<CodigoCABYS>${esc(linea.codigo_cabys)}</CodigoCABYS>` +
    codigoComercial +
    `<Cantidad>${esc(linea.cantidad)}</Cantidad>` +
    `<UnidadMedida>${esc(linea.unidad_medida)}</UnidadMedida>` +
    `<Detalle>${esc(linea.detalle)}</Detalle>` +
    `<PrecioUnitario>${esc(linea.precio_unitario)}</PrecioUnitario>` +
    `<MontoTotal>${esc(linea.monto_total)}</MontoTotal>` +
    descuento +
    `<SubTotal>${esc(linea.subtotal)}</SubTotal>` +
    `<BaseImponible>${esc(linea.subtotal)}</BaseImponible>` +
    buildImpuesto(linea) +
    `<ImpuestoAsumidoEmisorFabrica>0.00</ImpuestoAsumidoEmisorFabrica>` +
    `<ImpuestoNeto>${esc(linea.impuesto_neto ?? 0)}</ImpuestoNeto>` +
    `<MontoTotalLinea>${esc(linea.monto_total_linea)}</MontoTotalLinea>` +
    `</LineaDetalle>`;
}

// ─── Detalle Servicio ─────────────────────────────────────────────────────
export function buildDetalleServicio(lineas: LineaDetalle[]): string {
  if (!lineas.length) return "";
  return `<DetalleServicio>${lineas.map(buildLineaDetalle).join("")}</DetalleServicio>`;
}

// ─── Otros Cargos ─────────────────────────────────────────────────────────
export function buildOtrosCargos(doc: DocumentoElectronico): string {
  if (!doc.otros_cargos || !doc.otros_cargos.length) return "";
  return doc.otros_cargos
    .map(
      (c) =>
        `<OtrosCargos>` +
        `<TipoDocumento>${esc(c.tipo_documento)}</TipoDocumento>` +
        (c.numero_identidad
          ? `<NumeroIdentidadTercero>${esc(c.numero_identidad)}</NumeroIdentidadTercero>`
          : "") +
        (c.nombre ? `<NombreTercero>${esc(c.nombre)}</NombreTercero>` : "") +
        `<Detalle>${esc(c.detalle)}</Detalle>` +
        (c.porcentaje !== undefined
          ? `<Porcentaje>${esc(c.porcentaje)}</Porcentaje>`
          : "") +
        `<MontoCargo>${esc(c.monto_cargo)}</MontoCargo>` +
        `</OtrosCargos>`
    )
    .join("");
}

// ─── Resumen Factura ──────────────────────────────────────────────────────
export function buildResumenFactura(
  resumen: ResumenFactura,
  doc?: DocumentoElectronico
): string {
  // v4.4: CodigoTipoMoneda is REQUIRED (default to CRC)
  const codigoMoneda = resumen.codigo_tipo_moneda?.codigo_moneda || "CRC";
  const tipoCambio = resumen.codigo_tipo_moneda?.tipo_cambio || "1";
  const moneda = `<CodigoTipoMoneda>` +
    `<CodigoMoneda>${esc(codigoMoneda)}</CodigoMoneda>` +
    `<TipoCambio>${esc(tipoCambio)}</TipoCambio>` +
    `</CodigoTipoMoneda>`;

  // v4.4: TotalDesgloseImpuesto replaces TotalImpuesto (complex, per tax code)
  let desgloseImpuesto = "";
  if (resumen.total_impuesto > 0) {
    desgloseImpuesto = `<TotalDesgloseImpuesto>` +
      `<Codigo>01</Codigo>` +
      `<CodigoTarifaIVA>08</CodigoTarifaIVA>` +
      `<TotalMontoImpuesto>${esc(resumen.total_impuesto)}</TotalMontoImpuesto>` +
      `</TotalDesgloseImpuesto>`;
  }

  // v4.4: MedioPago moved into ResumenFactura as complex element
  const medioPago = doc
    ? doc.medio_pago.map((mp) =>
        `<MedioPago><TipoMedioPago>${esc(mp)}</TipoMedioPago></MedioPago>`
      ).join("")
    : "";

  return `<ResumenFactura>` +
    moneda +
    (resumen.total_servicios_gravados ? `<TotalServGravados>${esc(resumen.total_servicios_gravados)}</TotalServGravados>` : "") +
    (resumen.total_servicios_exentos ? `<TotalServExentos>${esc(resumen.total_servicios_exentos)}</TotalServExentos>` : "") +
    (resumen.total_servicios_exonerados ? `<TotalServExonerado>${esc(resumen.total_servicios_exonerados)}</TotalServExonerado>` : "") +
    (resumen.total_mercancias_gravadas ? `<TotalMercanciasGravadas>${esc(resumen.total_mercancias_gravadas)}</TotalMercanciasGravadas>` : "") +
    (resumen.total_mercancias_exentas ? `<TotalMercanciasExentas>${esc(resumen.total_mercancias_exentas)}</TotalMercanciasExentas>` : "") +
    (resumen.total_mercancias_exoneradas ? `<TotalMercExonerada>${esc(resumen.total_mercancias_exoneradas)}</TotalMercExonerada>` : "") +
    (resumen.total_gravado ? `<TotalGravado>${esc(resumen.total_gravado)}</TotalGravado>` : "") +
    (resumen.total_exento ? `<TotalExento>${esc(resumen.total_exento)}</TotalExento>` : "") +
    (resumen.total_exonerado ? `<TotalExonerado>${esc(resumen.total_exonerado)}</TotalExonerado>` : "") +
    `<TotalVenta>${esc(resumen.total_venta)}</TotalVenta>` +
    (resumen.total_descuentos ? `<TotalDescuentos>${esc(resumen.total_descuentos)}</TotalDescuentos>` : "") +
    `<TotalVentaNeta>${esc(resumen.total_venta_neta)}</TotalVentaNeta>` +
    desgloseImpuesto +
    (resumen.total_impuesto ? `<TotalImpuesto>${esc(resumen.total_impuesto)}</TotalImpuesto>` : "") +
    (resumen.total_iva_devuelto !== undefined
      ? `<TotalIVADevuelto>${esc(resumen.total_iva_devuelto)}</TotalIVADevuelto>`
      : "") +
    (resumen.total_otros_cargos !== undefined
      ? `<TotalOtrosCargos>${esc(resumen.total_otros_cargos)}</TotalOtrosCargos>`
      : "") +
    medioPago +
    `<TotalComprobante>${esc(resumen.total_comprobante)}</TotalComprobante>` +
    `</ResumenFactura>`;
}

// ─── Información de Referencia ────────────────────────────────────────────
export function buildInformacionReferencia(
  ref: DocumentoElectronico["informacion_referencia"]
): string {
  if (!ref) return "";
  return `<InformacionReferencia>` +
    `<TipoDoc>${esc(ref.tipo_doc)}</TipoDoc>` +
    `<Numero>${esc(ref.numero)}</Numero>` +
    `<FechaEmision>${esc(ref.fecha_emision)}</FechaEmision>` +
    `<Codigo>${esc(ref.codigo)}</Codigo>` +
    `<Razon>${esc(ref.razon)}</Razon>` +
    `</InformacionReferencia>`;
}

// ─── Condición de Venta / Medio de Pago ───────────────────────────────────
export function buildCondicionVenta(doc: DocumentoElectronico): string {
  // v4.4: MedioPago moved to ResumenFactura. Only CondicionVenta remains at root.
  return `<CondicionVenta>${esc(doc.condicion_venta)}</CondicionVenta>` +
    (doc.plazo_credito ? `<PlazoCredito>${esc(doc.plazo_credito)}</PlazoCredito>` : "");
}

// ─── Signature placeholder ───────────────────────────────────────────────
export function buildSignaturePlaceholder(): string {
  return `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="placeholder"/>`;
}
