// ─── Tax Calculation Engine (IVA CR v4.4) ────────────────────────────────

import type { LineaDetalle, Exoneracion, CodigoTarifa, ResumenFactura } from "../types";
import { CODIGO_TARIFA_IVA } from "../constants";

/**
 * Round to exactly 2 decimal places (banker's rounding / round half even is NOT used by Hacienda)
 * Hacienda uses standard rounding (round half up)
 */
export function roundHacienda(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Round to 5 decimal places for intermediate calculations
 */
export function round5(value: number): number {
  return roundHacienda(value, 5);
}

/**
 * Calculate tax for a single line item
 */
export function calcularImpuestoLinea(params: {
  cantidad: number;
  precio_unitario: number;
  descuento_monto?: number;
  codigo_tarifa?: CodigoTarifa;
  tarifa?: number;
  exoneracion?: Omit<Exoneracion, "monto_exoneracion">;
}): Omit<LineaDetalle, "numero_linea" | "codigo_cabys" | "detalle" | "unidad_medida"> {
  const { cantidad, precio_unitario, descuento_monto = 0, codigo_tarifa, tarifa, exoneracion } = params;

  const monto_total = round5(cantidad * precio_unitario);
  const subtotal = round5(monto_total - descuento_monto);

  let impuesto: LineaDetalle["impuesto"] = undefined;
  let impuesto_neto = 0;

  if (codigo_tarifa && tarifa && tarifa > 0) {
    const monto_impuesto_bruto = round5(subtotal * tarifa / 100);
    let monto_exoneracion = 0;
    let exoneracion_completa: Exoneracion | undefined;

    if (exoneracion && exoneracion.porcentaje_exoneracion > 0) {
      // ImpuestoNeto = (MontoLinea * TarifaIVA / 100) - MontoExonerado
      monto_exoneracion = round5(
        subtotal * exoneracion.porcentaje_exoneracion / 100
      );
      exoneracion_completa = {
        ...exoneracion,
        monto_exoneracion: roundHacienda(monto_exoneracion),
      };
    }

    const monto_impuesto = roundHacienda(monto_impuesto_bruto);
    impuesto_neto = roundHacienda(monto_impuesto - roundHacienda(monto_exoneracion));

    impuesto = {
      codigo: "01", // IVA
      codigo_tarifa,
      tarifa,
      monto: monto_impuesto,
      exoneracion: exoneracion_completa,
    };
  }

  const monto_total_linea = roundHacienda(subtotal + impuesto_neto);

  return {
    cantidad,
    precio_unitario: round5(precio_unitario),
    monto_total: round5(monto_total),
    descuento: descuento_monto > 0
      ? { monto: roundHacienda(descuento_monto), naturaleza: "Descuento comercial" }
      : undefined,
    subtotal: round5(subtotal),
    impuesto,
    impuesto_neto: impuesto ? impuesto_neto : undefined,
    monto_total_linea,
  };
}

/**
 * Calculate the ResumenFactura (invoice summary) from all line items
 */
export function calcularResumen(
  lineas: LineaDetalle[],
  moneda?: { codigo: string; tipo_cambio: number }
): ResumenFactura {
  let totalServiciosGravados = 0;
  let totalServiciosExentos = 0;
  let totalServiciosExonerados = 0;
  let totalMercanciasGravadas = 0;
  let totalMercanciasExentas = 0;
  let totalMercanciasExoneradas = 0;
  let totalDescuentos = 0;
  let totalImpuesto = 0;

  for (const linea of lineas) {
    const esServicio = linea.unidad_medida === "Sp" || linea.unidad_medida === "Spe";
    const tieneImpuesto = linea.impuesto && linea.impuesto.tarifa > 0;
    const tieneExoneracion = linea.impuesto?.exoneracion;

    const subtotal = linea.subtotal;

    if (esServicio) {
      if (tieneExoneracion) {
        totalServiciosExonerados += subtotal;
      } else if (tieneImpuesto) {
        totalServiciosGravados += subtotal;
      } else {
        totalServiciosExentos += subtotal;
      }
    } else {
      if (tieneExoneracion) {
        totalMercanciasExoneradas += subtotal;
      } else if (tieneImpuesto) {
        totalMercanciasGravadas += subtotal;
      } else {
        totalMercanciasExentas += subtotal;
      }
    }

    if (linea.descuento) {
      totalDescuentos += linea.descuento.monto;
    }

    if (linea.impuesto_neto) {
      totalImpuesto += linea.impuesto_neto;
    } else if (linea.impuesto) {
      totalImpuesto += linea.impuesto.monto;
    }
  }

  const totalGravado = roundHacienda(totalServiciosGravados + totalMercanciasGravadas);
  const totalExento = roundHacienda(totalServiciosExentos + totalMercanciasExentas);
  const totalExonerado = roundHacienda(totalServiciosExonerados + totalMercanciasExoneradas);
  const totalVenta = roundHacienda(totalGravado + totalExento + totalExonerado);
  const totalVentaNeta = roundHacienda(totalVenta - roundHacienda(totalDescuentos));
  const totalComprobante = roundHacienda(totalVentaNeta + roundHacienda(totalImpuesto));

  return {
    codigo_tipo_moneda: moneda
      ? { codigo_moneda: moneda.codigo, tipo_cambio: moneda.tipo_cambio }
      : undefined,
    total_servicios_gravados: roundHacienda(totalServiciosGravados),
    total_servicios_exentos: roundHacienda(totalServiciosExentos),
    total_servicios_exonerados: roundHacienda(totalServiciosExonerados),
    total_mercancias_gravadas: roundHacienda(totalMercanciasGravadas),
    total_mercancias_exentas: roundHacienda(totalMercanciasExentas),
    total_mercancias_exoneradas: roundHacienda(totalMercanciasExoneradas),
    total_gravado: totalGravado,
    total_exento: totalExento,
    total_exonerado: totalExonerado,
    total_venta: totalVenta,
    total_descuentos: roundHacienda(totalDescuentos),
    total_venta_neta: totalVentaNeta,
    total_impuesto: roundHacienda(totalImpuesto),
    total_comprobante: totalComprobante,
  };
}

/**
 * Get the IVA rate for a given tariff code
 */
export function getTarifaIVA(codigoTarifa: CodigoTarifa): number {
  return CODIGO_TARIFA_IVA[codigoTarifa] || 0;
}
