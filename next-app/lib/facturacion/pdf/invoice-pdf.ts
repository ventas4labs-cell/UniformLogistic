// ─── PDF "representación gráfica" — CR Hacienda v4.4 ─────────────────
// Letter-format PDF that humans actually read. The XML + Hacienda's
// response XML are the legal source of truth; this is the printable
// receipt customers expect alongside the XML attachment in their email.
//
// Uses jspdf (already a project dep). Sections:
//   • Header band — title, type, consecutivo, clave
//   • Emisor / Receptor cards
//   • Lines table — detalle, cantidad, precio, descuento, IVA, total
//   • Resumen — gravado, exonerado, descuentos, IVA, total
//   • Hacienda block — clave (full), estado, mensaje, fecha respuesta
//   • Footer — generated-at timestamp + branch info

import 'server-only';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoicePdfLine {
    numero_linea: number;
    detalle: string;
    cantidad: number;
    unidad_medida: string;
    precio_unitario: number;
    monto_descuento?: number;
    subtotal: number;
    monto_impuesto?: number;
    monto_total_linea: number;
}

export interface InvoicePdfDocumento {
    clave: string;
    consecutivo: string;
    tipo_documento: string;
    fecha_emision: string;
    emisor_nombre: string;
    emisor_cedula: string;
    receptor_nombre?: string | null;
    receptor_cedula?: string | null;
    condicion_venta?: string;
    medio_pago?: string[];
    total_venta: number;
    total_descuentos: number;
    total_impuesto: number;
    total_comprobante: number;
    estado_hacienda: string;
    mensaje_hacienda?: string | null;
    lineas: InvoicePdfLine[];
}

const TIPO_LABEL: Record<string, string> = {
    '01': 'Factura Electrónica',
    '02': 'Nota de Débito Electrónica',
    '03': 'Nota de Crédito Electrónica',
    '04': 'Tiquete Electrónico',
    '08': 'Factura Electrónica de Compra',
    '10': 'Mensaje Receptor'
};

const CONDICION_LABEL: Record<string, string> = {
    '01': 'Contado',
    '02': 'Crédito',
    '03': 'Consignación',
    '04': 'Apartado',
    '05': 'Arrendamiento opción compra',
    '99': 'Otros'
};
const MEDIO_LABEL: Record<string, string> = {
    '01': 'Efectivo',
    '02': 'Tarjeta',
    '03': 'Cheque',
    '04': 'Transferencia',
    '05': 'SINPE Móvil',
    '99': 'Otros'
};

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        minimumFractionDigits: 2
    }).format(n);

const fmtQty = (n: number) =>
    new Intl.NumberFormat('es-CR', { maximumFractionDigits: 5 }).format(n);

/**
 * Build a PDF Buffer (Node-side) representation of a single fe_documento.
 * Caller decides whether to email/store/stream it.
 */
export function buildInvoicePdf(doc: InvoicePdfDocumento): Buffer {
    const pdf = new jsPDF({ format: 'letter', unit: 'mm' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 14;
    const accent: [number, number, number] = [234, 88, 12]; // orange-600

    // ── Header band ─────────────────────────────────────────────────────
    pdf.setFillColor(accent[0], accent[1], accent[2]);
    pdf.rect(0, 0, pageWidth, 22, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(TIPO_LABEL[doc.tipo_documento] || `Documento ${doc.tipo_documento}`, margin, 11);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Consecutivo: ${doc.consecutivo}`, margin, 17);
    pdf.text(
        `Emitido: ${doc.fecha_emision.slice(0, 19).replace('T', ' ')}`,
        pageWidth - margin,
        17,
        { align: 'right' }
    );

    // Clave row
    let y = 28;
    pdf.setTextColor(80, 80, 80);
    pdf.setFontSize(7);
    pdf.text('CLAVE', margin, y);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(doc.clave, margin, y + 4);
    pdf.setFont('helvetica', 'normal');
    y += 12;

    // ── Emisor / Receptor cards ────────────────────────────────────────
    const cardW = (pageWidth - margin * 2 - 6) / 2;
    drawPartyCard(pdf, margin, y, cardW, 'EMISOR', doc.emisor_nombre, doc.emisor_cedula);
    drawPartyCard(
        pdf,
        margin + cardW + 6,
        y,
        cardW,
        'RECEPTOR',
        doc.receptor_nombre || '— (no aplica)',
        doc.receptor_cedula || '—'
    );
    y += 22;

    // Sale terms strip
    pdf.setFontSize(8);
    pdf.setTextColor(80, 80, 80);
    const terms: string[] = [];
    if (doc.condicion_venta) {
        terms.push(`Condición: ${CONDICION_LABEL[doc.condicion_venta] || doc.condicion_venta}`);
    }
    if (doc.medio_pago && doc.medio_pago.length > 0) {
        terms.push(
            `Medio: ${doc.medio_pago.map((m) => MEDIO_LABEL[m] || m).join(', ')}`
        );
    }
    if (terms.length > 0) {
        pdf.text(terms.join(' · '), margin, y);
        y += 6;
    }

    // ── Lines table ────────────────────────────────────────────────────
    autoTable(pdf, {
        startY: y,
        head: [['#', 'Detalle', 'Cant', 'Precio', 'Desc.', 'Subtotal', 'IVA', 'Total línea']],
        body: doc.lineas.map((l) => [
            l.numero_linea,
            l.detalle,
            `${fmtQty(l.cantidad)} ${l.unidad_medida || ''}`,
            fmtCRC(l.precio_unitario),
            l.monto_descuento ? fmtCRC(l.monto_descuento) : '—',
            fmtCRC(l.subtotal),
            fmtCRC(l.monto_impuesto || 0),
            fmtCRC(l.monto_total_linea)
        ]),
        theme: 'grid',
        headStyles: {
            fillColor: [60, 60, 60],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
        },
        styles: { fontSize: 8, cellPadding: 1.5 },
        columnStyles: {
            0: { halign: 'right', cellWidth: 8 },
            1: { cellWidth: 'auto' },
            2: { halign: 'right', cellWidth: 18 },
            3: { halign: 'right', cellWidth: 22 },
            4: { halign: 'right', cellWidth: 18 },
            5: { halign: 'right', cellWidth: 22 },
            6: { halign: 'right', cellWidth: 18 },
            7: { halign: 'right', cellWidth: 24, fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((pdf as any).lastAutoTable?.finalY || y) + 6;

    // ── Resumen ────────────────────────────────────────────────────────
    const totalsX = pageWidth - margin - 70;
    const row = (label: string, value: string, bold = false) => {
        if (bold) pdf.setFont('helvetica', 'bold');
        else pdf.setFont('helvetica', 'normal');
        pdf.text(label, totalsX, y);
        pdf.text(value, pageWidth - margin, y, { align: 'right' });
        y += 5;
    };
    pdf.setFontSize(9);
    row('Total venta', fmtCRC(doc.total_venta));
    row('Descuentos', fmtCRC(doc.total_descuentos));
    row('Total IVA', fmtCRC(doc.total_impuesto));
    pdf.setDrawColor(150, 150, 150);
    pdf.line(totalsX, y - 1, pageWidth - margin, y - 1);
    y += 1;
    pdf.setFontSize(11);
    row('TOTAL', fmtCRC(doc.total_comprobante), true);

    y += 4;

    // ── Hacienda block ─────────────────────────────────────────────────
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, y, pageWidth - margin * 2, 14, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(0, 0, 0);
    pdf.text('HACIENDA', margin + 2, y + 4.5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Estado: ${doc.estado_hacienda || '—'}`, margin + 32, y + 4.5);
    if (doc.mensaje_hacienda) {
        pdf.setFontSize(8);
        const lines = pdf.splitTextToSize(doc.mensaje_hacienda, pageWidth - margin * 2 - 4);
        pdf.text(lines.slice(0, 1), margin + 2, y + 10);
    }
    y += 18;

    // ── Footer ─────────────────────────────────────────────────────────
    pdf.setFontSize(7);
    pdf.setTextColor(140, 140, 140);
    pdf.text(
        'Representación gráfica de un comprobante electrónico. El XML firmado y la respuesta de Hacienda son el documento legal.',
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 8,
        { align: 'center' }
    );

    const arrayBuffer = pdf.output('arraybuffer') as ArrayBuffer;
    return Buffer.from(arrayBuffer);
}

function drawPartyCard(
    pdf: jsPDF,
    x: number,
    y: number,
    w: number,
    title: string,
    name: string,
    cedula: string
) {
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(x, y, w, 18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(title, x + 2, y + 4);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text(name, x + 2, y + 10);
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Cédula: ${cedula}`, x + 2, y + 15);
}
