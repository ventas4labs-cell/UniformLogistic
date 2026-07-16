import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Order, CartItem } from '@/lib/types';
import { extractSizeLabel, resolveBomQty } from '@/lib/services/products';

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
    const prefix = g === 'Men' ? 'Hombre' : g === 'Women' ? 'Mujer' : '';
    const s = item.selection.size || '';
    return prefix ? `${prefix} · ${s}` : s;
};

const formatPantSize = (item: CartItem): string => {
    if (item.selection.waist == null) return item.selection.size || '';
    const w = String(item.selection.waist);
    return item.selection.inseam != null ? `${w}/${item.selection.inseam}` : w;
};

// Canonical shirt-size ordering. Anything not listed sorts after these
// (numeric pant waists, then unknowns). XXL/2XL etc. are treated as the
// same rank so mixed naming still orders correctly.
const SHIRT_SIZE_RANK: Record<string, number> = {
    XS: 0,
    S: 1,
    M: 2,
    L: 3,
    XL: 4,
    '2XL': 5,
    XXL: 5,
    '3XL': 6,
    XXXL: 6,
    '4XL': 7,
    XXXXL: 7,
    '5XL': 8,
    XXXXXL: 8,
    '6XL': 9
};

// Decompose a size label like "H · 2XL", "M · L", "32" or "32/30" into a
// sort key. Gender prefix (H before M before none) is the primary axis;
// within a gender, shirt sizes follow SHIRT_SIZE_RANK and pant waists
// sort numerically after all letter sizes.
const sizeSortKey = (label: string): [number, number, string] => {
    let gender = '';
    let size = label.trim();
    // Accept full words ("Hombre · ", "Mujer · ") and legacy letters.
    const m = size.match(/^(hombre|mujer|[HM])\s*[·\-]\s*(.+)$/i);
    if (m) {
        gender = m[1];
        size = m[2].trim();
    }
    const g0 = gender.charAt(0).toLowerCase();
    const genderRank = g0 === 'h' ? 0 : g0 === 'm' ? 1 : 2;

    const upper = size.toUpperCase().replace(/\s+/g, '');
    const rank = SHIRT_SIZE_RANK[upper];
    if (rank !== undefined) return [genderRank, rank, label];

    const num = parseFloat(size);
    if (Number.isFinite(num)) return [genderRank, 1000 + num, label];

    return [genderRank, 9999, label];
};

const compareSizeLabels = (a: string, b: string): number => {
    const ka = sizeSortKey(a);
    const kb = sizeSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2]);
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

    const sizeLabels = Array.from(sizeSet).sort(compareSizeLabels);
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

export interface AdminPdfOptions {
    // External station(s) assigned to this order — rendered as an
    // "ESTACIÓN ASIGNADA" field under the dates. Used by the Bodega
    // export so the workshop knows who the order is going to.
    stationNames?: string[];
    // Bodega mode: drop the whole customer-info block (cliente,
    // contacto, dirección, teléfono, email, OC, fechas, estación) and
    // jump straight from the header to the item grids. The order
    // number stays (top-right of the header). The workshop only needs
    // the pieces + insumos, not the client's contact details.
    bodega?: boolean;
}

export const generateAdminPDF = (order: Order, opts: AdminPdfOptions = {}) => {
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

    if (opts.bodega) {
        // Bodega export: skip the customer-info block entirely. Just
        // restate the order number under the header so the printed
        // sheet is self-identifying, then go straight to the items.
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(0);
        doc.text(order.id, 14, y);
        y += 8;
    } else {
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
        y += 11;

        // Order number (also shown top-right) + assigned external
        // station, surfaced explicitly for the full sheet.
        const stationLabel =
            opts.stationNames && opts.stationNames.length > 0
                ? opts.stationNames.join(', ')
                : '';
        labeledField(doc, 14, y, dateW, 'N.º DE ORDEN', order.id || '');
        labeledField(doc, 14 + dateW + 4, y, dateW, 'ESTACIÓN ASIGNADA', stationLabel);
        y += 12;
    }

    const shirts = order.items.filter((i) => inferType(i) === 'shirt');
    const pants = order.items.filter((i) => inferType(i) === 'pant');

    if (shirts.length > 0) {
        y = drawSection(doc, y, 'CAMISAS', shirts, formatShirtSize);
    }
    if (pants.length > 0) {
        y = drawSection(doc, y, 'PANTALONES', pants, formatPantSize);
    }

    // Per-insumo, per-product breakdown so every row's math is self-evident:
    //   per-unit (admin BOM config) × pieces ordered of that product = subtotal
    // Total per insumo = sum of subtotals across contributing products.
    const bomBreakdown = new Map<
        string,
        {
            contributors: Map<string, { perUnit: number; pieces: number }>;
            total: number;
        }
    >();

    order.items.forEach((item) => {
        const bom = item.bom;
        if (!bom || bom.length === 0) return;
        const sizeLabel = extractSizeLabel(item.selection.size);
        bom.forEach((b) => {
            if (!b.name) return;
            // Resolve per-size override (XXL/XXXL/etc. may consume more
            // fabric than the base SKU). resolveBomQty falls back to
            // b.qty when no override matches.
            const perUnit = resolveBomQty(b, sizeLabel);
            if (perUnit <= 0) return;
            const entry = bomBreakdown.get(b.name) || {
                contributors: new Map<string, { perUnit: number; pieces: number }>(),
                total: 0
            };
            const productKey = item.productName;
            const existing = entry.contributors.get(productKey) || {
                perUnit,
                pieces: 0
            };
            // perUnit on the contributor record is informational. The
            // rendered "Cant. x Unidad" is computed downstream as a
            // weighted average (entry.total / piecesUsingInsumo), which
            // is the right thing when sizes within a product carry
            // different per-unit overrides.
            existing.perUnit = perUnit;
            existing.pieces += item.quantity;
            entry.contributors.set(productKey, existing);
            entry.total += perUnit * item.quantity;
            bomBreakdown.set(b.name, entry);
        });
    });

    const fmtNum = (n: number): number =>
        Number.isInteger(n) ? n : parseFloat(n.toFixed(2));

    if (bomBreakdown.size > 0) {
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

        const bomHead = ['Insumo', 'Cant. x Unidad', 'Total'];
        const bomBody: (string | number)[][] = [];

        bomBreakdown.forEach((entry, insumo) => {
            // Pieces ordered of products that use this insumo (the meaningful
            // denominator — products without this insumo don't dilute the avg).
            const piecesUsingInsumo = Array.from(entry.contributors.values()).reduce(
                (s, c) => s + c.pieces,
                0
            );
            // Weighted per-unit so per-unit × pieces = total holds for THIS insumo.
            // For single-product insumos this equals the admin-configured BOM qty.
            const perUnit = piecesUsingInsumo > 0 ? entry.total / piecesUsingInsumo : 0;
            bomBody.push([insumo, fmtNum(perUnit), fmtNum(entry.total)]);
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
                0: { halign: 'left', fontStyle: 'bold', cellWidth: 50 },
                1: { halign: 'right' },
                2: { halign: 'right', fontStyle: 'bold' }
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
