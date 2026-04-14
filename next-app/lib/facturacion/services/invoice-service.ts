// ─── Invoice Service — Main Orchestrator ─────────────────────────────────
// order → calculate taxes → generate XML → sign → send → store
//

import { createAdminClient } from "@/lib/supabase-admin";
import { generarClave } from "../xml/clave-generator";
import { getNextConsecutivo } from "../xml/consecutivo-generator";
import { buildXml } from "../xml/xml-builder";
import { signXml } from "../crypto/xades-signer";
import { getHaciendaToken } from "../auth/hacienda-oauth";
import { enviarDocumento, pollDocumentoStatus } from "../api/hacienda-client";
import { calcularImpuestoLinea, calcularResumen } from "../tax/tax-calculator";
import { decrypt } from "../crypto/encryption";
import type {
  EmitInvoiceRequest,
  FEConfig,
  DocumentoElectronico,
  LineaDetalle,
  EmisorReceptor,
  TipoDocumento,
} from "../types";
import { validateDocument } from "../validation/document-validator";
import { logAuditEvent, AUDIT_ACTIONS } from "./audit-service";
import { deliverAcceptedDocument } from "./delivery-service";
import { getProvinciaCode, getCantonCode, getDistritoCode } from "@/lib/costa-rica-locations";

// Note: fe_* tables are not yet in database.types.ts.
// Type assertions used until migration is run and types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const feFrom = (supabase: ReturnType<typeof createAdminClient>, table: string) => (supabase as any).from(table);

/**
 * Format a Date as ISO 8601 with Costa Rica timezone offset (-06:00).
 * Hacienda rejects dates ending in "Z" (UTC).
 */
function formatCRDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}-06:00`
  );
}

/**
 * Map Hacienda ind-estado to our internal estado.
 * Hacienda may return numeric codes ("1","2","3") OR text ("aceptado","rechazado","procesando").
 */
function mapIndEstado(indEstado: string): { estado: string | null; mensaje: string } {
  const map: Record<string, { estado: string | null; mensaje: string }> = {
    "1": { estado: "aceptado", mensaje: "Aceptado por Hacienda" },
    "2": { estado: "aceptado_parcial", mensaje: "Aceptado parcialmente por Hacienda" },
    "3": { estado: "rechazado", mensaje: "Rechazado por Hacienda" },
    "aceptado": { estado: "aceptado", mensaje: "Aceptado por Hacienda" },
    "aceptado parcial": { estado: "aceptado_parcial", mensaje: "Aceptado parcialmente por Hacienda" },
    "rechazado": { estado: "rechazado", mensaje: "Rechazado por Hacienda" },
    "procesando": { estado: null, mensaje: "Procesando en Hacienda" },
  };
  const key = (indEstado || "").toLowerCase().trim();
  return map[key] || { estado: null, mensaje: `Estado desconocido: ${indEstado}` };
}

interface EmitResult {
  success: boolean;
  clave?: string;
  consecutivo?: string;
  documento_id?: string;
  estado_hacienda?: string;
  error?: string;
}

/**
 * Main entry point: emit an electronic document (Factura, Tiquete, Nota, etc.)
 */
export async function emitirDocumento(request: EmitInvoiceRequest): Promise<EmitResult> {
  const supabase = createAdminClient();

  try {
    // 0. Validate document before processing
    const validation = validateDocument(request);
    if (!validation.valid) {
      return {
        success: false,
        error: `Errores de validación: ${validation.errors.join("; ")}`,
      };
    }

    // 1. Load branch FE configuration
    const { data: config, error: configError } = await feFrom(supabase, "fe_config")
      .select("*")
      .eq("branch_id", request.branch_id)
      .single();

    if (configError || !config) {
      return { success: false, error: "No se encontró configuración de facturación para esta sucursal" };
    }

    const feConfig = config as unknown as FEConfig;

    // 2. Get next consecutivo
    const { consecutivo, secuencial } = await getNextConsecutivo(
      request.branch_id,
      request.tipo_documento,
      feConfig.sucursal,
      feConfig.punto_venta
    );

    // 3. Generate clave (use Costa Rica timezone for date)
    const nowCR = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" })
    );
    const clave = generarClave({
      pais: "506",
      fecha: nowCR,
      cedula: feConfig.cedula_numero,
      consecutivo,
      situacion: request.situacion || "1",
    });

    // 4. Build emisor from config
    const emisor: EmisorReceptor = {
      nombre: feConfig.nombre_emisor,
      tipo_identificacion: feConfig.cedula_tipo,
      numero_identificacion: feConfig.cedula_numero,
      nombre_comercial: feConfig.nombre_comercial,
      correo: feConfig.correo_emisor,
      telefono: feConfig.telefono_emisor,
      ubicacion: feConfig.provincia
        ? {
            provincia: getProvinciaCode(feConfig.provincia),
            canton: getCantonCode(feConfig.provincia, feConfig.canton || "01"),
            distrito: getDistritoCode(feConfig.provincia, feConfig.canton || "01", feConfig.distrito || "01"),
            barrio: feConfig.barrio && /^\d+$/.test(feConfig.barrio.trim()) ? feConfig.barrio.trim().padStart(2, "0") : undefined,
            otras_senas: feConfig.otras_senas,
          }
        : undefined,
    };

    // 5. Calculate taxes for each line
    const lineas: LineaDetalle[] = request.lineas.map((linea, index) => {
      const calculo = calcularImpuestoLinea({
        cantidad: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        descuento_monto: linea.descuento?.monto,
        codigo_tarifa: linea.impuesto?.codigo_tarifa,
        tarifa: linea.impuesto?.tarifa,
        exoneracion: linea.impuesto?.exoneracion,
      });

      return {
        numero_linea: index + 1,
        codigo_cabys: linea.codigo_cabys,
        detalle: linea.detalle,
        unidad_medida: linea.unidad_medida || "Unid",
        ...calculo,
      };
    });

    // 6. Calculate invoice summary
    const resumen = calcularResumen(lineas);

    // 6b. Normalize receptor ubicacion codes (text → Hacienda numeric)
    let receptor = request.receptor;
    if (receptor?.ubicacion) {
      const u = receptor.ubicacion;
      receptor = {
        ...receptor,
        ubicacion: {
          ...u,
          provincia: getProvinciaCode(u.provincia),
          canton: getCantonCode(u.provincia, u.canton),
          distrito: getDistritoCode(u.provincia, u.canton, u.distrito),
        },
      };
    }

    // 7. Build the DocumentoElectronico
    const documento: DocumentoElectronico = {
      clave,
      consecutivo,
      tipo_documento: request.tipo_documento,
      fecha_emision: formatCRDateTime(nowCR),
      situacion: request.situacion || "1",
      codigo_actividad: request.codigo_actividad || feConfig.codigo_actividad,
      emisor,
      receptor,
      condicion_venta: request.condicion_venta || "01",
      medio_pago: request.medio_pago || ["01"],
      lineas,
      resumen,
      referencia: request.referencia,
    };

    // 8. Generate XML
    const xmlEnviado = buildXml(request.tipo_documento, documento);

    // 9. Sign XML (if certificate is configured)
    let xmlFirmado = xmlEnviado;
    if (feConfig.p12_certificate_path && feConfig.p12_pin_encrypted) {
      console.log("[FE] Signing XML with certificate:", feConfig.p12_certificate_path);
      const pin = decrypt(feConfig.p12_pin_encrypted);

      // Load certificate from Supabase Storage
      const { data: certData, error: certError } = await supabase.storage
        .from("certificates")
        .download(feConfig.p12_certificate_path);

      if (certError || !certData) {
        console.error("[FE] Certificate download error:", certError);
        return { success: false, error: `No se pudo cargar el certificado digital: ${certError?.message || "archivo no encontrado"}` };
      }

      const p12Buffer = Buffer.from(await certData.arrayBuffer());
      console.log("[FE] Certificate loaded, size:", p12Buffer.length, "bytes");
      try {
        xmlFirmado = signXml(xmlEnviado, p12Buffer, pin);
        console.log("[FE] XML signed successfully");
      } catch (signError) {
        console.error("[FE] XML signing error:", signError);
        return { success: false, error: `Error firmando XML: ${signError instanceof Error ? signError.message : String(signError)}` };
      }
    } else {
      console.warn("[FE] WARNING: No certificate configured — sending UNSIGNED XML (Hacienda will reject it)");
    }

    // 10. Store document in database
    const { data: docRow, error: insertError } = await feFrom(supabase, "fe_documentos")
      .insert({
        branch_id: request.branch_id,
        order_id: request.order_id || null,
        clave,
        consecutivo,
        tipo_documento: request.tipo_documento,
        fecha_emision: formatCRDateTime(nowCR),
        emisor_cedula: feConfig.cedula_numero,
        emisor_nombre: feConfig.nombre_emisor,
        receptor_cedula: request.receptor?.numero_identificacion || null,
        receptor_nombre: request.receptor?.nombre || null,
        condicion_venta: request.condicion_venta || "01",
        medio_pago: request.medio_pago || ["01"],
        total_venta: resumen.total_venta,
        total_descuentos: resumen.total_descuentos,
        total_impuesto: resumen.total_impuesto,
        total_comprobante: resumen.total_comprobante,
        xml_enviado: xmlEnviado,
        xml_firmado: xmlFirmado,
        estado_hacienda: "pendiente",
        estado_envio: "no_enviado",
      })
      .select("id")
      .single();

    if (insertError || !docRow) {
      return { success: false, error: `Error guardando documento: ${insertError?.message}` };
    }

    // 11. Store line items
    const lineRows = lineas.map((l) => ({
      documento_id: docRow.id,
      numero_linea: l.numero_linea,
      codigo_cabys: l.codigo_cabys,
      detalle: l.detalle,
      cantidad: l.cantidad,
      unidad_medida: l.unidad_medida,
      precio_unitario: l.precio_unitario,
      monto_total: l.monto_total,
      monto_descuento: l.descuento?.monto || 0,
      naturaleza_descuento: l.descuento?.naturaleza || null,
      subtotal: l.subtotal,
      codigo_impuesto: l.impuesto?.codigo || null,
      codigo_tarifa: l.impuesto?.codigo_tarifa || null,
      tarifa: l.impuesto?.tarifa || null,
      monto_impuesto: l.impuesto?.monto || null,
      exoneracion_tipo: l.impuesto?.exoneracion?.tipo_documento || null,
      exoneracion_numero: l.impuesto?.exoneracion?.numero_documento || null,
      exoneracion_institucion: l.impuesto?.exoneracion?.nombre_institucion || null,
      exoneracion_fecha: l.impuesto?.exoneracion?.fecha_emision || null,
      exoneracion_porcentaje: l.impuesto?.exoneracion?.porcentaje_exoneracion || null,
      exoneracion_monto: l.impuesto?.exoneracion?.monto_exoneracion || null,
      impuesto_neto: l.impuesto_neto || null,
      monto_total_linea: l.monto_total_linea,
    }));

    await feFrom(supabase, "fe_lineas").insert(lineRows);

    // 12. Send to Hacienda
    let estadoHacienda = "pendiente";
    try {
      const token = await getHaciendaToken(request.branch_id);

      const sendResult = await enviarDocumento({
        clave,
        xmlFirmado,
        token: token.access_token,
        environment: feConfig.environment,
        emisorCedula: feConfig.cedula_numero,
        emisorTipoCedula: feConfig.cedula_tipo,
        receptorCedula: request.receptor?.numero_identificacion,
        receptorTipoCedula: request.receptor?.tipo_identificacion,
      });

      if (sendResult.success) {
        await feFrom(supabase, "fe_documentos")
          .update({
            estado_envio: "enviado",
            intentos_envio: 1,
            ultimo_intento_at: new Date().toISOString(),
          })
          .eq("id", docRow.id);

        // 13. Poll for status (non-blocking — do in background)
        pollDocumentoStatus({
          clave,
          token: token.access_token,
          environment: feConfig.environment,
          maxAttempts: 5,
          intervalMs: 5000,
        })
          .then(async (pollResult) => {
            if (pollResult) {
              const { estado, mensaje } = mapIndEstado(pollResult["ind-estado"]);
              console.log("[FE] Poll ind-estado:", pollResult["ind-estado"], "→", estado || "still processing");

              if (estado) {
                await feFrom(supabase, "fe_documentos")
                  .update({
                    estado_hacienda: estado,
                    estado_envio: "confirmado",
                    xml_respuesta_hacienda: pollResult["respuesta-xml"] || null,
                    mensaje_hacienda: mensaje,
                  })
                  .eq("id", docRow.id);

                // Trigger delivery (PDF + email) for accepted documents
                if (estado === "aceptado") {
                  deliverAcceptedDocument(docRow.id)
                    .then((r) => console.log("[FE] Delivery result:", r))
                    .catch((e) => console.error("[FE] Delivery error:", e));
                }
              } else {
                await feFrom(supabase, "fe_documentos")
                  .update({
                    estado_hacienda: "procesando",
                    estado_envio: "enviado",
                    mensaje_hacienda: mensaje,
                  })
                  .eq("id", docRow.id);
              }
            }
          })
          .catch((err) => {
            console.error("[FE] Polling error/timeout:", err);
            // On timeout, leave as procesando for the polling service to pick up
            feFrom(supabase, "fe_documentos")
              .update({
                estado_hacienda: "procesando",
                estado_envio: "enviado",
                mensaje_hacienda: "Enviado a Hacienda, esperando respuesta",
              })
              .eq("id", docRow.id)
              .then(() => {})
              .catch(() => {});
          });

        estadoHacienda = "procesando";
      } else {
        await feFrom(supabase, "fe_documentos")
          .update({
            estado_envio: "error",
            mensaje_hacienda: sendResult.message,
            intentos_envio: 1,
            ultimo_intento_at: new Date().toISOString(),
          })
          .eq("id", docRow.id);

        estadoHacienda = "error";
      }
    } catch (sendError) {
      const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
      console.error("[FE] Error sending to Hacienda:", errorMsg, sendError);

      // Store the error in the document so it's visible in the UI
      await feFrom(supabase, "fe_documentos")
        .update({
          estado_hacienda: "error",
          estado_envio: "error",
          mensaje_hacienda: `Error interno: ${errorMsg}`,
          intentos_envio: 1,
          ultimo_intento_at: new Date().toISOString(),
        })
        .eq("id", docRow.id);

      estadoHacienda = "error";
    }

    // Audit: log successful emission
    logAuditEvent({
      branch_id: request.branch_id,
      action: AUDIT_ACTIONS.EMIT,
      document_id: docRow.id,
      clave,
      details: {
        tipo_documento: request.tipo_documento,
        total_comprobante: resumen.total_comprobante,
        estado_hacienda: estadoHacienda,
      },
    }).catch(() => {});

    return {
      success: true,
      clave,
      consecutivo,
      documento_id: docRow.id,
      estado_hacienda: estadoHacienda,
    };
  } catch (error) {
    console.error("[FE] Error emitting document:", error);

    // Audit: log emission error
    logAuditEvent({
      branch_id: request.branch_id,
      action: AUDIT_ACTIONS.EMIT,
      details: {
        tipo_documento: request.tipo_documento,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
    }).catch(() => {});

    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido al emitir documento",
    };
  }
}

/**
 * Retry sending a document that failed or is still pending
 */
export async function reintentarEnvio(documentoId: string): Promise<EmitResult> {
  const supabase = createAdminClient();
  console.log("[FE Retry] Starting retry for document:", documentoId);

  const { data: doc, error } = await feFrom(supabase, "fe_documentos")
    .select("*")
    .eq("id", documentoId)
    .single();

  if (error || !doc) {
    console.error("[FE Retry] Document not found:", error?.message);
    return { success: false, error: "Documento no encontrado" };
  }

  console.log("[FE Retry] Document state:", {
    clave: doc.clave,
    estado_hacienda: doc.estado_hacienda,
    estado_envio: doc.estado_envio,
    has_xml_enviado: !!doc.xml_enviado,
    has_xml_firmado: !!doc.xml_firmado,
    intentos: doc.intentos_envio,
  });

  if (doc.estado_hacienda === "aceptado") {
    return { success: true, clave: doc.clave, estado_hacienda: "aceptado" };
  }

  if (!doc.xml_enviado) {
    console.error("[FE Retry] No XML available for document");
    return { success: false, error: "Documento no tiene XML generado. Debe re-emitirse." };
  }

  try {
    console.log("[FE Retry] Getting auth token for branch:", doc.branch_id);
    const token = await getHaciendaToken(doc.branch_id);
    console.log("[FE Retry] Token obtained, expires_in:", token.expires_in);

    const { data: config } = await feFrom(supabase, "fe_config")
      .select("environment, cedula_tipo, cedula_numero, p12_certificate_path, p12_pin_encrypted")
      .eq("branch_id", doc.branch_id)
      .single();

    if (!config) {
      return { success: false, error: "Configuración de facturación no encontrada" };
    }

    // ── Re-sign the original XML with the (fixed) signer ─────────────
    // For rejected documents, the previous signature was invalid.
    // We must re-sign from the original unsigned xml_enviado.
    let xmlToSend = doc.xml_enviado;

    if (config.p12_certificate_path && config.p12_pin_encrypted) {
      console.log("[FE Retry] Re-signing XML with certificate:", config.p12_certificate_path);
      const pin = decrypt(config.p12_pin_encrypted);
      const { data: certData, error: certError } = await supabase.storage
        .from("certificates")
        .download(config.p12_certificate_path);

      if (certError || !certData) {
        console.error("[FE Retry] Certificate download error:", certError);
        return { success: false, error: `No se pudo cargar el certificado: ${certError?.message}` };
      }

      const p12Buffer = Buffer.from(await certData.arrayBuffer());
      try {
        xmlToSend = signXml(doc.xml_enviado, p12Buffer, pin);
        console.log("[FE Retry] XML re-signed successfully");

        // Update the stored signed XML
        await feFrom(supabase, "fe_documentos")
          .update({ xml_firmado: xmlToSend })
          .eq("id", documentoId);
      } catch (signError) {
        console.error("[FE Retry] XML signing error:", signError);
        return { success: false, error: `Error firmando XML: ${signError instanceof Error ? signError.message : String(signError)}` };
      }
    } else {
      console.warn("[FE Retry] WARNING: No certificate configured — sending unsigned XML");
    }

    console.log("[FE Retry] Sending to Hacienda, env:", config.environment);
    const sendResult = await enviarDocumento({
      clave: doc.clave,
      xmlFirmado: xmlToSend,
      token: token.access_token,
      environment: config.environment as "staging" | "production",
      emisorCedula: config.cedula_numero,
      emisorTipoCedula: config.cedula_tipo,
      receptorCedula: doc.receptor_cedula || undefined,
      receptorTipoCedula: doc.receptor_cedula ? "01" : undefined,
    });

    console.log("[FE Retry] Send result:", sendResult);

    const newAttempts = (doc.intentos_envio || 0) + 1;

    await feFrom(supabase, "fe_documentos")
      .update({
        estado_envio: sendResult.success ? "enviado" : "error",
        estado_hacienda: sendResult.success ? "procesando" : "error",
        mensaje_hacienda: sendResult.message,
        intentos_envio: newAttempts,
        ultimo_intento_at: new Date().toISOString(),
      })
      .eq("id", documentoId);

    if (sendResult.success) {
      // Poll for status in background
      console.log("[FE Retry] Starting background poll for:", doc.clave);
      pollDocumentoStatus({
        clave: doc.clave,
        token: token.access_token,
        environment: config.environment as "staging" | "production",
        maxAttempts: 5,
        intervalMs: 5000,
      })
        .then(async (pollResult) => {
          if (pollResult) {
            const { estado, mensaje } = mapIndEstado(pollResult["ind-estado"]);
            console.log("[FE Retry] Poll ind-estado:", pollResult["ind-estado"], "→", estado || "still processing");

            if (estado) {
              await feFrom(supabase, "fe_documentos")
                .update({
                  estado_hacienda: estado,
                  estado_envio: "confirmado",
                  xml_respuesta_hacienda: pollResult["respuesta-xml"] || null,
                  mensaje_hacienda: mensaje,
                })
                .eq("id", documentoId);

              // Trigger delivery (PDF + email) for accepted documents
              if (estado === "aceptado") {
                deliverAcceptedDocument(documentoId)
                  .then((r) => console.log("[FE Retry] Delivery result:", r))
                  .catch((e) => console.error("[FE Retry] Delivery error:", e));
              }
            } else {
              await feFrom(supabase, "fe_documentos")
                .update({
                  estado_hacienda: "procesando",
                  estado_envio: "enviado",
                  mensaje_hacienda: mensaje,
                })
                .eq("id", documentoId);
            }
          }
        })
        .catch((err) => {
          console.error("[FE Retry] Poll error:", err);
          // Poll timeout — leave as "procesando" for the polling service to pick up later
          feFrom(supabase, "fe_documentos")
            .update({
              estado_hacienda: "procesando",
              estado_envio: "enviado",
              mensaje_hacienda: "Enviado a Hacienda, esperando respuesta",
            })
            .eq("id", documentoId)
            .then(() => {})
            .catch(() => {});
        });
    }

    return {
      success: sendResult.success,
      clave: doc.clave,
      estado_hacienda: sendResult.success ? "procesando" : "error",
      error: sendResult.success ? undefined : sendResult.message,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al reintentar envío";
    console.error("[FE Retry] Error:", errorMsg, err);

    // Store error in DB
    await feFrom(supabase, "fe_documentos")
      .update({
        estado_hacienda: "error",
        estado_envio: "error",
        mensaje_hacienda: `Error: ${errorMsg}`,
        intentos_envio: (doc.intentos_envio || 0) + 1,
        ultimo_intento_at: new Date().toISOString(),
      })
      .eq("id", documentoId);

    return { success: false, error: errorMsg };
  }
}
