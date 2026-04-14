// ─── 50-Digit Clave Generator (Resolución MH-DGT-RES-0027-2024) ─────────
//
// Format: País(3) + Fecha(6) + Cédula(12) + Consecutivo(20) + CódigoSeguridad(8) + Situación(1)
// Total: 50 digits
//

import { randomInt } from "crypto";
import { PAIS_CODIGO } from "../constants";
import type { ClaveParams } from "../types";

/**
 * Generates the 50-digit "Clave Numérica" required by Hacienda CR
 */
export function generarClave(params: ClaveParams): string {
  const pais = PAIS_CODIGO; // "506"
  const fecha = formatFechaClave(params.fecha); // DDMMYY (6 digits)
  const cedula = padCedula(params.cedula); // 12 digits, left-padded with zeros
  const consecutivo = params.consecutivo; // 20 digits (already formatted)
  const codigoSeguridad = params.codigo_seguridad || generarCodigoSeguridad(); // 8 digits
  const situacion = params.situacion; // 1 digit

  // Resolución DGT-R-48-2016: pos 42 = Situación (1 digit), pos 43-50 = Código Seguridad (8 digits)
  const clave = `${pais}${fecha}${cedula}${consecutivo}${situacion}${codigoSeguridad}`;

  if (clave.length !== 50) {
    throw new Error(
      `Clave must be exactly 50 digits, got ${clave.length}: ${clave}`
    );
  }

  if (!/^\d{50}$/.test(clave)) {
    throw new Error(`Clave must contain only digits: ${clave}`);
  }

  return clave;
}

/**
 * Format date as DDMMYY (6 digits)
 */
function formatFechaClave(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

/**
 * Pad cedula to exactly 12 digits (left-padded with zeros)
 * Strips any non-digit characters first
 */
function padCedula(cedula: string): string {
  const digits = cedula.replace(/\D/g, "");
  if (digits.length > 12) {
    throw new Error(`Cédula cannot exceed 12 digits: ${cedula}`);
  }
  return digits.padStart(12, "0");
}

/**
 * Generate a random 8-digit security code
 */
export function generarCodigoSeguridad(): string {
  const code = randomInt(0, 100000000);
  return String(code).padStart(8, "0");
}
