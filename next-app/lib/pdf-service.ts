import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, CartItem } from '@/lib/types';

const createDoc = () => new jsPDF();

const drawHeader = (doc: jsPDF, order: Order, title: string = 'UNIFORM LOGISTIC') => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const primaryColor = [245, 124, 0] as const;

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, 20);

    doc.setTextColor(100);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Ref: ${order.id} | Fecha: ${new Date(order.dateCreated).toLocaleDateString()}`, 14, 28);

    doc.setDrawColor(200);
    doc.line(14, 34, pageWidth - 14, 34);

    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Cliente: ${order.customerName} (${order.companyName})`, 14, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(`Contacto: ${order.phone} | ${order.email}`, 14, 45);
    doc.text(`Entrega: ${order.deliveryDate}`, 14, 50);
};

export const generateCustomerPDF = (order: Order) => {
    const doc = createDoc();
    drawHeader(doc, order);

    let startY = 60;

    const groupedItems: Record<string, CartItem[]> = {};
    order.items.forEach((item) => {
        if (!groupedItems[item.productName]) groupedItems[item.productName] = [];
        groupedItems[item.productName].push(item);
    });

    Object.keys(groupedItems).forEach((productName) => {
        const items = groupedItems[productName];

        doc.setFontSize(11);
        doc.setTextColor(245, 124, 0);
        doc.setFont('helvetica', 'bold');
        doc.text(productName.toUpperCase(), 14, startY);
        startY += 5;

        const tableBody: (string | number)[][] = items.map((item) => {
            let sizeStr = '';
            if (item.selection.gender)
                sizeStr += `${item.selection.gender === 'Men' ? 'Hombre' : 'Mujer'} - `;
            if (item.selection.waist) {
                sizeStr += `C${item.selection.waist}"`;
                if (item.selection.inseam) sizeStr += ` / L${item.selection.inseam}"`;
            } else if (item.selection.size) {
                sizeStr += item.selection.size;
            }
            return [sizeStr, item.quantity];
        });

        tableBody.push(['SUBTOTAL', items.reduce((s, i) => s + i.quantity, 0)]);

        autoTable(doc, {
            startY,
            head: [['Talla / Opción', 'Cantidad']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [80, 80, 80] },
            styles: { fontSize: 10 },
            margin: { left: 14, right: 14 }
        });

        startY =
            (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
                .finalY + 10;
    });

    const total = order.items.reduce((s, i) => s + i.quantity, 0);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`TOTAL PIEZAS: ${total}`, 14, startY + 5);

    return doc;
};

const inferType = (item: CartItem): 'shirt' | 'pant' => {
    if (item.productType) return item.productType;
    if (item.selection.waist) return 'pant';
    const n = item.productName.toLowerCase();
    if (n.includes('pant') || n.includes('pantal')) return 'pant';
    return 'shirt';
};

const formatShirtSize = (item: CartItem): string => {
    const g = item.selection.gender;
    const prefix = g === 'Men' ? 'H' : g === 'Women' ? 'M' : '';
    const s = item.selection.size || '';
    return prefix ? `${prefix}-${s}` : s;
};

const formatPantSize = (item: CartItem): string => {
    if (item.selection.waist == null) return item.selection.size || '';
    const w = String(item.selection.waist);
    return item.selection.inseam != null ? `${w}/${item.selection.inseam}` : w;
};

const buildSizeGrid = (
    items: CartItem[],
    sizeFormatter: (item: CartItem) => string
) => {
    const rowMap = new Map<
        string,
        { tela: string; estilo: string; sizes: Map<string, number> }
    >();
    const sizeSet = new Set<string>();

    for (const item of items) {
        const tela = item.fabricType || '—';
        const estilo = item.productName;
        const key = `${tela}||${estilo}`;
        if (!rowMap.has(key)) {
            rowMap.set(key, { tela, estilo, sizes: new Map() });
        }
        const row = rowMap.get(key)!;
        const sizeLabel = sizeFormatter(item) || '—';
        sizeSet.add(sizeLabel);
        row.sizes.set(sizeLabel, (row.sizes.get(sizeLabel) || 0) + item.quantity);
    }

    const sizeLabels = Array.from(sizeSet).sort();
    const head = ['Tela', 'Estilo', ...sizeLabels, 'Total'];
    const body: (string | number)[][] = Array.from(rowMap.values()).map((row) => {
        const cells: (string | number)[] = [row.tela, row.estilo];
        let rowTotal = 0;
        for (const label of sizeLabels) {
            const q = row.sizes.get(label) || 0;
            rowTotal += q;
            cells.push(q || '');
        }
        cells.push(rowTotal);
        return cells;
    });

    const totals: (string | number)[] = ['', 'TOTAL'];
    let grand = 0;
    for (const label of sizeLabels) {
        const colTotal = Array.from(rowMap.values()).reduce(
            (s, r) => s + (r.sizes.get(label) || 0),
            0
        );
        grand += colTotal;
        totals.push(colTotal || '');
    }
    totals.push(grand);
    body.push(totals);

    return { head, body, grand };
};

const drawSection = (
    doc: jsPDF,
    startY: number,
    title: string,
    items: CartItem[],
    sizeFormatter: (item: CartItem) => string
): number => {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(245, 124, 0);
    doc.rect(14, startY, pageWidth - 28, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, 16, startY + 4.3);

    const { head, body } = buildSizeGrid(items, sizeFormatter);

    autoTable(doc, {
        startY: startY + 7,
        head: [head],
        body,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 1.5,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            halign: 'center'
        },
        headStyles: {
            fillColor: [230, 230, 230],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center'
        },
        columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 28 },
            1: { halign: 'left', cellWidth: 38 }
        },
        didParseCell: (data) => {
            if (data.row.index === body.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [245, 245, 245];
            }
        },
        margin: { left: 14, right: 14 }
    });

    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 6;
};

const labeledField = (
    doc: jsPDF,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string
) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0);
    const text = value || '—';
    doc.text(text, x, y + 4, { maxWidth: width });
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(x, y + 5.5, x + width, y + 5.5);
};

export const generateAdminPDF = (order: Order) => {
    const doc = createDoc();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const primary = [245, 124, 0] as const;

    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('UNIFORM LOGISTIC', 14, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Cédula Jurídica 3-101-795102', 14, 17);
    doc.text('Tel. 2263-9093  ·  Santo Domingo, Heredia', 14, 20.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(order.id, pageWidth - 14, 14, { align: 'right' });

    let y = 32;
    const colW = (pageWidth - 28) / 2;

    labeledField(doc, 14, y, colW - 4, 'CLIENTE', order.companyName || order.customerName || '');
    labeledField(doc, 14 + colW, y, colW - 4, 'CONTACTO', order.customerName || '');
    y += 11;

    labeledField(doc, 14, y, pageWidth - 28, 'DIRECCIÓN', order.address || '');
    y += 11;

    const triW = (pageWidth - 28) / 3 - 2;
    labeledField(doc, 14, y, triW, 'TELÉFONO', order.phone || '');
    labeledField(doc, 14 + triW + 3, y, triW, 'EMAIL', order.email || '');
    labeledField(doc, 14 + (triW + 3) * 2, y, triW, 'ORDEN DE COMPRA', order.purchaseOrder || '');
    y += 11;

    const dateW = (pageWidth - 28) / 2 - 2;
    const dateRecibido = order.dateCreated
        ? new Date(order.dateCreated).toLocaleDateString()
        : '';
    labeledField(doc, 14, y, dateW, 'FECHA DE RECIBIDO', dateRecibido);
    labeledField(doc, 14 + dateW + 4, y, dateW, 'FECHA DE ENTREGA', order.deliveryDate || '');
    y += 12;

    const shirts = order.items.filter((i) => inferType(i) === 'shirt');
    const pants = order.items.filter((i) => inferType(i) === 'pant');

    if (shirts.length > 0) {
        y = drawSection(doc, y, 'CAMISAS', shirts, formatShirtSize);
    }
    if (pants.length > 0) {
        y = drawSection(doc, y, 'PANTALONES', pants, formatPantSize);
    }

    const bomTotals = new Map<
        string,
        { perUnit: Map<string, number>; total: number }
    >();

    order.items.forEach((item) => {
        const bom = item.bom;
        if (!bom || bom.length === 0) return;
        bom.forEach((b) => {
            if (!b.name || b.qty <= 0) return;
            const entry = bomTotals.get(b.name) || {
                perUnit: new Map<string, number>(),
                total: 0
            };
            const prodKey = item.productName;
            entry.perUnit.set(prodKey, (entry.perUnit.get(prodKey) || 0) + b.qty);
            entry.total += b.qty * item.quantity;
            bomTotals.set(b.name, entry);
        });
    });

    if (bomTotals.size > 0) {
        if (y > pageHeight - 60) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(primary[0], primary[1], primary[2]);
        doc.rect(14, y, pageWidth - 28, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('INSUMOS REQUERIDOS', 16, y + 4.3);

        const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

        const bomHead = ['Insumo', 'Cant. x Unidad', `Total (×${totalPieces} pzas)`];
        const bomBody: (string | number)[][] = [];
        bomTotals.forEach((entry, name) => {
            const perUnitVals = Array.from(entry.perUnit.values());
            const avgPerUnit =
                perUnitVals.reduce((a, b) => a + b, 0) / perUnitVals.length;
            const perUnitDisplay = Number.isInteger(avgPerUnit)
                ? avgPerUnit
                : parseFloat(avgPerUnit.toFixed(2));
            bomBody.push([name, perUnitDisplay, parseFloat(entry.total.toFixed(2))]);
        });

        autoTable(doc, {
            startY: y + 7,
            head: [bomHead],
            body: bomBody,
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 1.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0],
                halign: 'center'
            },
            headStyles: {
                fillColor: [60, 60, 60],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                halign: 'center',
                fontSize: 7.5
            },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 }
            },
            margin: { left: 14, right: 14 }
        });

        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
            .finalY + 6;
    }

    if (y > pageHeight - 60) {
        doc.addPage();
        y = 20;
    }

    doc.setFillColor(primary[0], primary[1], primary[2]);
    doc.rect(14, y, pageWidth - 28, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('OBSERVACIONES', 16, y + 4.3);
    y += 8;

    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.rect(14, y, pageWidth - 28, 22);
    if (order.notes) {
        doc.setTextColor(0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(order.notes, 16, y + 5, { maxWidth: pageWidth - 32 });
    }
    y += 30;

    if (y > pageHeight - 30) {
        doc.addPage();
        y = pageHeight - 30;
    }

    const sigW = (pageWidth - 28) / 2 - 6;
    doc.setDrawColor(80);
    doc.setLineWidth(0.3);
    doc.line(14, y + 8, 14 + sigW, y + 8);
    doc.line(14 + sigW + 12, y + 8, pageWidth - 14, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text('Elaborado por', 14 + sigW / 2, y + 13, { align: 'center' });
    doc.text('Recibido conforme', 14 + sigW + 12 + sigW / 2, y + 13, { align: 'center' });

    return doc;
};
