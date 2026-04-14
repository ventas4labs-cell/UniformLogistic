// ─── XML Builder Dispatcher — CR e-invoicing v4.4 ─────────────────────────
import type { DocumentoElectronico, TipoDocumento } from "../types";
import { buildFacturaElectronica } from "./templates/factura-01";
import { buildTiqueteElectronico } from "./templates/tiquete-04";

const builders: Partial<Record<TipoDocumento, (doc: DocumentoElectronico) => string>> = {
    "01": buildFacturaElectronica,
    "04": buildTiqueteElectronico,
};

export function buildXml(tipo: TipoDocumento, doc: DocumentoElectronico): string {
    const builder = builders[tipo];
    if (!builder) {
        throw new Error(
            `Tipo de documento ${tipo} aún no está implementado. Implementados: 01 (Factura), 04 (Tiquete).`
        );
    }
    return builder(doc);
}
