// ─── Facturacion Electronica CR v4.4 — Hacienda API Client ───────────────

import type { Ambiente, HaciendaResponse } from "../types";
import { getHaciendaEndpoints } from "../config";
import { getRateLimiter } from "./rate-limiter";

// ─── Types ───────────────────────────────────────────────────────────────

export interface EnviarDocumentoParams {
  clave: string;
  xmlFirmado: string;
  token: string;
  environment: Ambiente;
  emisorCedula: string;
  emisorTipoCedula: string;
  receptorCedula?: string;
  receptorTipoCedula?: string;
}

export interface EnviarDocumentoResult {
  success: boolean;
  status: number;
  message: string;
}

export interface ConsultarDocumentoParams {
  clave: string;
  token: string;
  environment: Ambiente;
}

export interface PollDocumentoStatusParams {
  clave: string;
  token: string;
  environment: Ambiente;
  maxAttempts?: number;
  intervalMs?: number;
}

// ─── enviarDocumento ─────────────────────────────────────────────────────

/**
 * Submit a signed electronic document to Hacienda for processing.
 *
 * POST {api_url}/recepcion
 * Expected response: 202 Accepted (queued for async processing).
 */
export async function enviarDocumento(
  params: EnviarDocumentoParams,
): Promise<EnviarDocumentoResult> {
  const {
    clave,
    xmlFirmado,
    token,
    environment,
    emisorCedula,
    emisorTipoCedula,
    receptorCedula,
    receptorTipoCedula,
  } = params;

  const { api_url } = getHaciendaEndpoints(environment);
  const url = `${api_url}/recepcion`;

  // Base64-encode the signed XML
  const comprobanteXml = Buffer.from(xmlFirmado, "utf-8").toString("base64");

  // Build request body
  const body: Record<string, unknown> = {
    clave,
    fecha: new Date().toISOString(),
    emisor: {
      tipoIdentificacion: emisorTipoCedula,
      numeroIdentificacion: emisorCedula,
    },
    comprobanteXml,
  };

  if (receptorCedula && receptorTipoCedula) {
    body.receptor = {
      tipoIdentificacion: receptorTipoCedula,
      numeroIdentificacion: receptorCedula,
    };
  }

  // Respect rate limit
  const limiter = getRateLimiter();
  await limiter.acquire();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 202) {
      return {
        success: true,
        status: 202,
        message: "Documento aceptado para procesamiento",
      };
    }

    // Handle known error codes
    const errorText = await response.text().catch(() => "");

    if (response.status === 400) {
      return {
        success: false,
        status: 400,
        message: `Error de validacion: ${errorText}`,
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        status: 401,
        message: "Error de autenticacion: token invalido o expirado",
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        status: 429,
        message: "Rate limit excedido — reintentar mas tarde",
      };
    }

    return {
      success: false,
      status: response.status,
      message: `Error inesperado (${response.status}): ${errorText}`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error de red desconocido";
    return {
      success: false,
      status: 0,
      message: `Error de conexion: ${message}`,
    };
  }
}

// ─── consultarDocumento ──────────────────────────────────────────────────

/**
 * Query the status of a previously submitted document.
 *
 * GET {api_url}/recepcion/{clave}
 * Expected: 200 with HaciendaResponse, or 404 if still processing.
 */
export async function consultarDocumento(
  params: ConsultarDocumentoParams,
): Promise<HaciendaResponse | null> {
  const { clave, token, environment } = params;
  const { api_url } = getHaciendaEndpoints(environment);
  const url = `${api_url}/recepcion/${clave}`;

  const limiter = getRateLimiter();
  await limiter.acquire();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 200) {
    const data = (await response.json()) as HaciendaResponse;
    console.log("[FE] Hacienda consulta response:", {
      clave: data.clave?.substring(0, 20) + "...",
      "ind-estado": data["ind-estado"],
      hasRespuestaXml: !!data["respuesta-xml"],
    });
    return data;
  }

  if (response.status === 404) {
    // Document not yet processed
    return null;
  }

  const errorText = await response.text().catch(() => "");
  throw new Error(
    `Error al consultar documento (${response.status}): ${errorText}`,
  );
}

// ─── pollDocumentoStatus ─────────────────────────────────────────────────

/**
 * Poll Hacienda for a document's final status after an initial 202 response.
 *
 * Retries up to `maxAttempts` times with `intervalMs` between each attempt.
 * Returns the HaciendaResponse once a result is available, or throws on timeout.
 */
export async function pollDocumentoStatus(
  params: PollDocumentoStatusParams,
): Promise<HaciendaResponse> {
  const {
    clave,
    token,
    environment,
    maxAttempts = 10,
    intervalMs = 5000,
  } = params;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await consultarDocumento({ clave, token, environment });

    if (result !== null) {
      return result;
    }

    // Wait before the next attempt (skip delay after the last attempt)
    if (attempt < maxAttempts) {
      await delay(intervalMs);
    }
  }

  throw new Error(
    `Timeout: el documento ${clave} no fue procesado despues de ${maxAttempts} intentos`,
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
