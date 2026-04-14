// ─── CABYS Code Validator ─────────────────────────────────────────────────

/**
 * Validates a CABYS (Clasificador de Bienes y Servicios) code.
 * Must be exactly 13 numeric digits and not all zeros.
 */
export function validateCABYS(codigo: string): { valid: boolean; error?: string } {
  if (!codigo) {
    return { valid: false, error: "El codigo CABYS es requerido" };
  }

  if (!/^\d+$/.test(codigo)) {
    return { valid: false, error: "El codigo CABYS debe contener solo digitos numericos" };
  }

  if (codigo.length !== 13) {
    return {
      valid: false,
      error: `El codigo CABYS debe tener exactamente 13 digitos, se recibieron ${codigo.length}`,
    };
  }

  if (/^0+$/.test(codigo)) {
    return { valid: false, error: "El codigo CABYS no puede ser todos ceros" };
  }

  return { valid: true };
}
