// ─── Inbound XML parser ──────────────────────────────────────────────
// Parses a supplier-emitted Hacienda-style XML into the shape we store
// in fe_facturas_recibidas + fe_lineas_recibidas. The parser is tolerant
// of namespaces (factura, nota credito, nota debito, factura compra) and
// pulls a minimal set of fields needed to acknowledge via Mensaje
// Receptor + show in the inbound list.
//
// Uses @xmldom/xmldom (already a project dep). Strict XML-only —
// we don't accept truncated/HTML-wrapped variants.

import 'server-only';
import { DOMParser } from '@xmldom/xmldom';

// xmldom ships its own DOM types that aren't structurally compatible with
// lib.dom's `Element` (no classList/clientHeight/etc.). For this parser
// we only need name + child + text access, so we declare a minimal shape
// and operate on that. Keeps the file usable from Node without pulling
// in the lib.dom mismatch.
interface XmlNode {
    localName?: string | null;
    nodeName: string;
    textContent?: string | null;
    getElementsByTagName(tag: string): { length: number; item(i: number): XmlNode | null };
}

export interface InboundDocument {
    clave: string;
    consecutivo: string | null;
    tipo_documento: '01' | '02' | '03' | '04' | '08';
    fecha_emision: string;
    emisor_cedula: string;
    emisor_nombre: string | null;
    receptor_cedula: string | null;
    receptor_nombre: string | null;
    total_venta: number;
    total_descuentos: number;
    total_impuesto: number;
    total_comprobante: number;
    lineas: InboundLine[];
}

export interface InboundLine {
    numero_linea: number;
    codigo_cabys: string | null;
    detalle: string | null;
    cantidad: number;
    unidad_medida: string | null;
    precio_unitario: number;
    subtotal: number;
    monto_impuesto: number;
    monto_total_linea: number;
}

// Map root element name → tipo_documento.
const ROOT_TO_TIPO: Record<string, InboundDocument['tipo_documento']> = {
    FacturaElectronica: '01',
    NotaDebitoElectronica: '02',
    NotaCreditoElectronica: '03',
    TiqueteElectronico: '04',
    FacturaElectronicaCompra: '08'
};

function text(el: XmlNode, tag: string): string | null {
    // Namespace-agnostic — match by local name only.
    const nodes = el.getElementsByTagName('*');
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes.item(i);
        if (!n) continue;
        // localName is set when present, otherwise nodeName is "ns:tag".
        const localName = (n as Element).localName || n.nodeName.split(':').pop();
        if (localName === tag) {
            return (n.textContent || '').trim();
        }
    }
    return null;
}

function textIn(parent: XmlNode, tag: string): string | null {
    return text(parent, tag);
}

function num(s: string | null): number {
    if (!s) return 0;
    const n = parseFloat(s.replace(/,/g, '.'));
    return Number.isFinite(n) ? n : 0;
}

export function parseInboundXml(xml: string): InboundDocument {
    // xmldom logs to stderr by default. Silencing is best done by ignoring
    // the warning sink — we don't pass `errorHandler` (the new typings only
    // accept a single function, but the old object form is still supported
    // at runtime and we don't want either; ignore failures and check root).
    const dom = new DOMParser().parseFromString(xml, 'text/xml');
    const root = dom.documentElement as unknown as XmlNode | null;
    if (!root) throw new Error('XML inválido: sin elemento raíz');

    const rootLocal = root.localName || root.nodeName.split(':').pop() || '';
    const tipo = ROOT_TO_TIPO[rootLocal];
    if (!tipo) {
        throw new Error(`Tipo de documento no soportado en inbound: ${rootLocal}`);
    }

    const clave = text(root, 'Clave');
    if (!clave || clave.length !== 50) {
        throw new Error('Clave inválida o ausente');
    }
    const consecutivo = text(root, 'NumeroConsecutivo');
    const fechaEmision = text(root, 'FechaEmision') || '';

    // Find Emisor / Receptor / Resumen blocks by name.
    let emisorEl: XmlNode | null = null;
    let receptorEl: XmlNode | null = null;
    let resumenEl: XmlNode | null = null;
    const detalleLineas: XmlNode[] = [];
    const all = root.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
        const n = all.item(i) as XmlNode | null;
        if (!n) continue;
        const local = n.localName || n.nodeName.split(':').pop();
        if (local === 'Emisor' && !emisorEl) emisorEl = n;
        else if (local === 'Receptor' && !receptorEl) receptorEl = n;
        else if (local === 'ResumenFactura' && !resumenEl) resumenEl = n;
        else if (local === 'LineaDetalle') detalleLineas.push(n);
    }

    const emisorCedula = emisorEl
        ? textIn(emisorEl, 'Numero') || ''
        : '';
    const emisorNombre = emisorEl ? textIn(emisorEl, 'Nombre') : null;
    const receptorCedula = receptorEl ? textIn(receptorEl, 'Numero') : null;
    const receptorNombre = receptorEl ? textIn(receptorEl, 'Nombre') : null;

    const total_venta = num(resumenEl ? textIn(resumenEl, 'TotalVenta') : null);
    const total_descuentos = num(resumenEl ? textIn(resumenEl, 'TotalDescuentos') : null);
    const total_impuesto = num(resumenEl ? textIn(resumenEl, 'TotalImpuesto') : null);
    const total_comprobante = num(resumenEl ? textIn(resumenEl, 'TotalComprobante') : null);

    const lineas: InboundLine[] = detalleLineas.map((linea, i) => ({
        numero_linea: parseInt(textIn(linea, 'NumeroLinea') || `${i + 1}`, 10),
        codigo_cabys: textIn(linea, 'CodigoCABYS'),
        detalle: textIn(linea, 'Detalle'),
        cantidad: num(textIn(linea, 'Cantidad')),
        unidad_medida: textIn(linea, 'UnidadMedida'),
        precio_unitario: num(textIn(linea, 'PrecioUnitario')),
        subtotal: num(textIn(linea, 'SubTotal')),
        monto_impuesto: num(textIn(linea, 'ImpuestoNeto') ?? textIn(linea, 'Monto')),
        monto_total_linea: num(textIn(linea, 'MontoTotalLinea'))
    }));

    return {
        clave,
        consecutivo,
        tipo_documento: tipo,
        fecha_emision: fechaEmision,
        emisor_cedula: emisorCedula,
        emisor_nombre: emisorNombre,
        receptor_cedula: receptorCedula,
        receptor_nombre: receptorNombre,
        total_venta,
        total_descuentos,
        total_impuesto,
        total_comprobante,
        lineas
    };
}
