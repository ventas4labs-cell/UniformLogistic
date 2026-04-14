// ─── Facturación Electrónica CR v4.4 — Config ───────────────────────────

import type { Ambiente } from "./types";

interface HaciendaEndpoints {
  idp_url: string;
  api_url: string;
  client_id: string;
}

const ENDPOINTS: Record<Ambiente, HaciendaEndpoints> = {
  staging: {
    idp_url:
      process.env.HACIENDA_IDP_URL_STAGING ||
      "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
    api_url:
      process.env.HACIENDA_API_URL_STAGING ||
      "https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1",
    client_id: "api-stag",
  },
  production: {
    idp_url:
      process.env.HACIENDA_IDP_URL_PROD ||
      "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
    api_url:
      process.env.HACIENDA_API_URL_PROD ||
      "https://api.comprobanteselectronicos.go.cr/recepcion/v1",
    client_id: "api-prod",
  },
};

export function getHaciendaEndpoints(env?: Ambiente): HaciendaEndpoints {
  const ambiente = env || (process.env.HACIENDA_ENVIRONMENT as Ambiente) || "staging";
  return ENDPOINTS[ambiente];
}

export function getEncryptionKey(): Buffer {
  const key = process.env.FE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("FE_ENCRYPTION_KEY environment variable is required for credential encryption");
  }
  return Buffer.from(key, "hex");
}
