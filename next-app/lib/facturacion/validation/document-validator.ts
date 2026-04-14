// ─── Comprehensive Document Validator ──────────────────────────────────────
// Validates all fields before emission per MH-DGT-RES-0027-2024 v4.4

import type { EmitInvoiceRequest } from "../types";
import { validateCABYS } from "./cabys-validator";
import { validateCedula } from "./cedula-validator";
import { validateExoneracion } from "./exoneracion-validator";

export interface DocumentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Valid values per MH specification
const CONDICION_VENTA_VALIDAS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "99"];
const MEDIO_PAGO_VALIDOS = ["01", "02", "03", "04", "05", "99"];
const UNIDADES_MEDIDA_COMUNES = [
  "Unid", "Kg", "m", "m2", "m3", "L", "cm", "g", "ml",
  "Hr", "Min", "Seg", "Día", "Mes", "Año", "Sp", "Os", "Otros",
];

/**
 * Comprehensive validation of an emission request before sending to Hacienda.
 * Checks all required fields, formats, and business rules.
 */
export function validateDocument(request: EmitInvoiceRequest): DocumentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Required fields
  if (!request.branch_id) {
    errors.push("branch_id es requerido");
  }

  if (!request.tipo_documento) {
    errors.push("Tipo de documento es requerido");
  }

  // 2. Lines validation
  if (!request.lineas || request.lineas.length === 0) {
    errors.push("Al menos una línea de detalle es requerida");
  } else {
    // Per-line validation
    request.lineas.forEach((linea, idx) => {
      // CABYS validation per line
      const cabysResult = validateCABYS(linea.codigo_cabys);
      if (!cabysResult.valid) {
        errors.push(`Línea ${idx + 1} (${linea.detalle || "sin detalle"}): ${cabysResult.error}`);
      }
      const lineNum = idx + 1;

      if (!linea.detalle || linea.detalle.trim() === "") {
        errors.push(`Línea ${lineNum}: detalle es requerido`);
      }

      if (!linea.cantidad || linea.cantidad <= 0) {
        errors.push(`Línea ${lineNum}: cantidad debe ser mayor a 0`);
      }

      if (!linea.precio_unitario || linea.precio_unitario < 0) {
        errors.push(`Línea ${lineNum}: precio unitario no puede ser negativo`);
      }

      // Validate discount
      if (linea.descuento) {
        if (linea.descuento.monto < 0) {
          errors.push(`Línea ${lineNum}: monto de descuento no puede ser negativo`);
        }
        const montoTotal = linea.cantidad * linea.precio_unitario;
        if (linea.descuento.monto > montoTotal) {
          errors.push(`Línea ${lineNum}: descuento (${linea.descuento.monto}) excede monto total (${montoTotal})`);
        }
        if (!linea.descuento.naturaleza || linea.descuento.naturaleza.trim() === "") {
          warnings.push(`Línea ${lineNum}: naturaleza del descuento no especificada`);
        }
      }

      // Validate tax
      if (linea.impuesto) {
        if (linea.impuesto.tarifa < 0 || linea.impuesto.tarifa > 100) {
          errors.push(`Línea ${lineNum}: tarifa IVA debe estar entre 0 y 100`);
        }

        // Validate exoneration
        if (linea.impuesto.exoneracion) {
          const exonResult = validateExoneracion(linea.impuesto.exoneracion as any);
          if (!exonResult.valid) {
            errors.push(...exonResult.errors.map((e) => `Línea ${lineNum}: ${e}`));
          }
        }
      }

      // Warn about uncommon units
      if (linea.unidad_medida && !UNIDADES_MEDIDA_COMUNES.includes(linea.unidad_medida)) {
        warnings.push(`Línea ${lineNum}: unidad de medida "${linea.unidad_medida}" no es estándar`);
      }
    });
  }

  // 3. Receptor validation by document type
  if (request.tipo_documento === "01") {
    // Factura electrónica requires receptor
    if (!request.receptor) {
      errors.push("Factura Electrónica (01) requiere datos del receptor");
    }
  }

  if (request.receptor) {
    if (!request.receptor.nombre || request.receptor.nombre.trim() === "") {
      errors.push("Nombre del receptor es requerido");
    }

    if (request.receptor.tipo_identificacion && request.receptor.numero_identificacion) {
      const cedulaResult = validateCedula(
        request.receptor.tipo_identificacion,
        request.receptor.numero_identificacion
      );
      if (!cedulaResult.valid) {
        errors.push(`Receptor: ${cedulaResult.error}`);
      }
    }

    if (request.receptor.correo) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(request.receptor.correo)) {
        errors.push("Correo del receptor no es válido");
      }
    }
  }

  // 4. Condición de venta
  if (request.condicion_venta && !CONDICION_VENTA_VALIDAS.includes(request.condicion_venta)) {
    errors.push(`Condición de venta inválida: ${request.condicion_venta}. Valores válidos: ${CONDICION_VENTA_VALIDAS.join(", ")}`);
  }

  // 5. Medio de pago
  if (request.medio_pago) {
    for (const mp of request.medio_pago) {
      if (!MEDIO_PAGO_VALIDOS.includes(mp)) {
        errors.push(`Medio de pago inválido: ${mp}. Valores válidos: ${MEDIO_PAGO_VALIDOS.join(", ")}`);
      }
    }
  }

  // 6. Situación
  if (request.situacion && !["1", "2", "3"].includes(request.situacion)) {
    errors.push(`Situación del comprobante inválida: ${request.situacion}. Valores: 1=Normal, 2=Contingencia, 3=Sin Internet`);
  }

  // 7. Referencia (for credit/debit notes)
  if (request.tipo_documento === "02" || request.tipo_documento === "03") {
    // ND and NC normally require a reference
    if (!request.referencia) {
      warnings.push("Notas de crédito/débito normalmente requieren documento de referencia");
    }
  }

  if (request.referencia) {
    if (!request.referencia.numero || request.referencia.numero.trim() === "") {
      errors.push("Número de documento de referencia es requerido");
    }
    if (!request.referencia.fecha_emision) {
      errors.push("Fecha de emisión del documento de referencia es requerida");
    }
    if (!request.referencia.razon || request.referencia.razon.trim() === "") {
      errors.push("Razón de la referencia es requerida");
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
