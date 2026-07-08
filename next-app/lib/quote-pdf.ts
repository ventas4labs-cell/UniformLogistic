import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { computeQuoteTotals } from '@/lib/services/quotes';

// Shape kept minimal on purpose: the builder passes its live draft
// (which may not be persisted yet), so this cannot depend on DB ids.
export interface QuotePdfInput {
    quoteRef: string;
    quoteDate: string;
    validUntil: string | null;
    clientName: string;
    companyName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    discountPct: number;
    taxPct: number;
    currency: string;
    items: {
        name: string;
        fabricType: string;
        color: string;
        unitPrice: number;
        pricePerLogo: number;
        quantity: number;
        logoCount: number;
    }[];
}

const ORANGE = [245, 124, 0] as const;

const money = (n: number, currency: string) =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
    }).format(n);

export function generateQuotePDF(q: QuotePdfInput): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header — same house style as the order PDFs.
    doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIFORM LOGISTIC', 14, 20);

    doc.setTextColor(100);
    doc.setFontSize(11);
    doc.text('COTIZACIÓN', 14, 27);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateLine = `Ref: ${q.quoteRef} | Fecha: ${new Date(q.quoteDate).toLocaleDateString('es-CR')}`;
    const validLine = q.validUntil
        ? ` | Válida hasta: ${new Date(q.validUntil).toLocaleDateString('es-CR')}`
        : '';
    doc.text(dateLine + validLine, 14, 33);

    doc.setDrawColor(200);
    doc.line(14, 38, pageWidth - 14, 38);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'bold');
    let y = 45;
    if (q.companyName || q.clientName) {
        doc.text(
            `Cliente: ${[q.clientName, q.companyName].filter(Boolean).join(' — ')}`,
            14,
            y
        );
        y += 5;
    }
    doc.setFont('helvetica', 'normal');
    if (q.contactEmail || q.contactPhone) {
        doc.text(
            `Contacto: ${[q.contactPhone, q.contactEmail].filter(Boolean).join(' | ')}`,
            14,
            y
        );
        y += 5;
    }
    y += 3;

    // Items table.
    autoTable(doc, {
        startY: y,
        head: [['Producto', 'Tela / Color', 'Logos', 'Cant.', 'Precio unit.', 'Subtotal']],
        body: q.items.map((it) => {
            // Effective per-unit price folds in the per-logo charge so
            // that unit × qty === subtotal on the printed line.
            const effUnit = it.unitPrice + it.pricePerLogo * it.logoCount;
            const spec = [it.fabricType, it.color].filter(Boolean).join(' · ') || '—';
            return [
                it.name,
                spec,
                it.logoCount > 0 ? String(it.logoCount) : '—',
                String(it.quantity),
                money(effUnit, q.currency),
                money(effUnit * it.quantity, q.currency)
            ];
        }),
        theme: 'striped',
        headStyles: { fillColor: [80, 80, 80] },
        styles: { fontSize: 10 },
        columnStyles: {
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
        },
        margin: { left: 14, right: 14 }
    });

    const afterTable =
        (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
            ?.finalY ?? y + 10;

    // Totals block, right-aligned.
    const totals = computeQuoteTotals(q);
    const rows: [string, string][] = [
        ['Subtotal', money(totals.subtotal, q.currency)]
    ];
    if (q.discountPct > 0) {
        rows.push([
            `Descuento (${q.discountPct}%)`,
            `- ${money(totals.discount, q.currency)}`
        ]);
    }
    rows.push([`IVA (${q.taxPct}%)`, money(totals.tax, q.currency)]);
    rows.push(['TOTAL', money(totals.total, q.currency)]);

    let ty = afterTable + 8;
    const labelX = pageWidth - 90;
    const valueX = pageWidth - 14;
    doc.setFontSize(10);
    for (const [label, value] of rows) {
        const isTotal = label === 'TOTAL';
        doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
        if (isTotal) {
            doc.setDrawColor(150);
            doc.line(labelX, ty - 4, valueX, ty - 4);
            doc.setFontSize(12);
            doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
        } else {
            doc.setTextColor(60);
        }
        doc.text(label, labelX, ty);
        doc.text(value, valueX, ty, { align: 'right' });
        ty += isTotal ? 0 : 6;
    }
    doc.setTextColor(0);
    doc.setFontSize(10);

    // Notes.
    if (q.notes) {
        let ny = ty + 14;
        doc.setFont('helvetica', 'bold');
        doc.text('Notas:', 14, ny);
        doc.setFont('helvetica', 'normal');
        ny += 5;
        const wrapped = doc.splitTextToSize(q.notes, pageWidth - 28);
        doc.text(wrapped, 14, ny);
    }

    // Footer.
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(
        'Uniform Logistic · San José, Costa Rica · ulogisticcr@gmail.com',
        14,
        pageHeight - 10
    );

    return doc;
}
