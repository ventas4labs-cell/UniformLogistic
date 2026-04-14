// ─── 20-Digit Consecutivo Generator ──────────────────────────────────────
//
// Format: Sucursal(3) + PuntoVenta(5) + TipoDocumento(2) + Secuencial(10)
// Total: 20 digits

import type { ConsecutivoParams, TipoDocumento } from "../types";
import { createAdminClient } from "@/lib/supabase-admin";

export function formatConsecutivo(params: ConsecutivoParams): string {
    const sucursal = params.sucursal.padStart(3, "0");
    const puntoVenta = params.punto_venta.padStart(5, "0");
    const tipoDoc = params.tipo_documento;
    const secuencial = String(params.secuencial).padStart(10, "0");

    const consecutivo = `${sucursal}${puntoVenta}${tipoDoc}${secuencial}`;

    if (consecutivo.length !== 20) {
        throw new Error(
            `Consecutivo must be exactly 20 digits, got ${consecutivo.length}: ${consecutivo}`
        );
    }

    return consecutivo;
}

export async function getNextConsecutivo(
    branchId: string,
    tipoDocumento: TipoDocumento,
    sucursal: string = "001",
    puntoVenta: string = "00001"
): Promise<{ consecutivo: string; secuencial: number }> {
    const supabase = createAdminClient();

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "next_consecutivo",
        {
            p_branch_id: branchId,
            p_tipo: tipoDocumento,
        }
    );

    if (rpcError) {
        throw new Error(
            `Error obteniendo consecutivo atómico: ${rpcError.message}. ` +
            `Verifique que la función next_consecutivo() exista en la base de datos.`
        );
    }

    const secuencial = rpcResult as number;

    if (secuencial > 9999999999) {
        throw new Error(
            `Secuencial excede el máximo permitido (9999999999) para tipo ${tipoDocumento}`
        );
    }

    const consecutivo = formatConsecutivo({
        sucursal,
        punto_venta: puntoVenta,
        tipo_documento: tipoDocumento,
        secuencial,
    });

    return { consecutivo, secuencial };
}
