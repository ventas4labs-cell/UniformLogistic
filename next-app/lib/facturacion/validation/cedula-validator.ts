// ─── Cedula / Identification Validator ────────────────────────────────────

const CEDULA_RULES: Record<string, { label: string; lengths: number[] }> = {
  "01": { label: "Cedula Fisica", lengths: [9] },
  "02": { label: "Cedula Juridica", lengths: [10] },
  "03": { label: "DIMEX", lengths: [11, 12] },
  "04": { label: "NITE", lengths: [10] },
};

/**
 * Validates an identification number according to Costa Rica's
 * Hacienda rules for each identification type.
 *
 * @param tipo - Identification type code ("01" | "02" | "03" | "04")
 * @param numero - The identification number (non-digit characters are stripped)
 */
export function validateCedula(
  tipo: string,
  numero: string,
): { valid: boolean; error?: string } {
  if (!tipo) {
    return { valid: false, error: "El tipo de identificacion es requerido" };
  }

  const rule = CEDULA_RULES[tipo];
  if (!rule) {
    return {
      valid: false,
      error: `Tipo de identificacion "${tipo}" no es valido. Valores permitidos: 01 (Fisica), 02 (Juridica), 03 (DIMEX), 04 (NITE)`,
    };
  }

  if (!numero) {
    return { valid: false, error: `El numero de ${rule.label} es requerido` };
  }

  // Strip non-digit characters
  const digits = numero.replace(/\D/g, "");

  if (digits.length === 0) {
    return {
      valid: false,
      error: `El numero de ${rule.label} no contiene digitos validos`,
    };
  }

  if (!rule.lengths.includes(digits.length)) {
    const expected =
      rule.lengths.length === 1
        ? `exactamente ${rule.lengths[0]}`
        : `${rule.lengths.join(" o ")}`;
    return {
      valid: false,
      error: `${rule.label} debe tener ${expected} digitos, se recibieron ${digits.length}`,
    };
  }

  return { valid: true };
}
