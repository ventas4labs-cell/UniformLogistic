// ─── Exoneracion (Tax Exemption) Validator ────────────────────────────────

import { TIPO_DOC_EXONERACION } from "../constants";

interface ExoneracionInput {
  tipo_documento?: string;
  numero_documento?: string;
  nombre_institucion?: string;
  fecha_emision?: string;
  porcentaje_exoneracion?: number;
}

const TIPOS_VALIDOS = ["01", "02", "03", "04", "05", "06", "07"];

/**
 * Validates all fields of an exoneracion (tax exemption) object.
 * Returns a list of all validation errors found.
 */
export function validateExoneracion(
  exo: ExoneracionInput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // tipo_documento
  if (!exo.tipo_documento) {
    errors.push("El tipo de documento de exoneracion es requerido");
  } else if (!TIPOS_VALIDOS.includes(exo.tipo_documento)) {
    const labels = TIPOS_VALIDOS.map(
      (t) => `${t} (${TIPO_DOC_EXONERACION[t]})`,
    ).join(", ");
    errors.push(
      `Tipo de documento de exoneracion "${exo.tipo_documento}" no es valido. Valores permitidos: ${labels}`,
    );
  }

  // numero_documento
  if (!exo.numero_documento) {
    errors.push("El numero de documento de exoneracion es requerido");
  } else if (
    exo.numero_documento.length < 1 ||
    exo.numero_documento.length > 40
  ) {
    errors.push(
      "El numero de documento de exoneracion debe tener entre 1 y 40 caracteres",
    );
  }

  // nombre_institucion
  if (!exo.nombre_institucion) {
    errors.push("El nombre de la institucion de exoneracion es requerido");
  }

  // fecha_emision
  if (!exo.fecha_emision) {
    errors.push("La fecha de emision de la exoneracion es requerida");
  } else {
    const fecha = new Date(exo.fecha_emision);
    if (isNaN(fecha.getTime())) {
      errors.push(
        "La fecha de emision de la exoneracion no es una fecha valida",
      );
    } else if (fecha > new Date()) {
      errors.push(
        "La fecha de emision de la exoneracion no puede ser en el futuro",
      );
    }
  }

  // porcentaje_exoneracion
  if (exo.porcentaje_exoneracion == null) {
    errors.push("El porcentaje de exoneracion es requerido");
  } else if (
    exo.porcentaje_exoneracion < 0 ||
    exo.porcentaje_exoneracion > 100
  ) {
    errors.push("El porcentaje de exoneracion debe estar entre 0 y 100");
  }

  return { valid: errors.length === 0, errors };
}
