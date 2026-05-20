// ─── XML Builder Dispatcher — CR e-invoicing v4.4 ─────────────────────────
import type { DocumentoElectronico, TipoDocumento } from "../types";
import { buildFacturaElectronica } from "./templates/factura-01";
import { buildTiqueteElectronico } from "./templates/tiquete-04";
import { buildNotaCreditoElectronica } from "./templates/nota-credito-03";
import { buildNotaDebitoElectronica } from "./templates/nota-debito-02";
import { buildFacturaElectronicaCompra } from "./templates/factura-compra-08";
import { buildMensajeReceptor } from "./templates/mensaje-receptor-10";

const builders: Partial<Record<TipoDocumento, (doc: DocumentoElectronico) => string>> = {
    "01": buildFacturaElectronica,
    "02": buildNotaDebitoElectronica,
    "03": buildNotaCreditoElectronica,
    "04": buildTiqueteElectronico,
    "08": buildFacturaElectronicaCompra,
    "10": buildMensajeReceptor,
};

export function buildXml(tipo: TipoDocumento, doc: DocumentoElectronico): string {
    const builder = builders[tipo];
    if (!builder) {
        throw new Error(
            `Tipo de documento ${tipo} no implementado.`
        );
    }
    return builder(doc);
}
