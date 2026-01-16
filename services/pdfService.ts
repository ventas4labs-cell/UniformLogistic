import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, CartItem } from '../types';
import { getMaterialReq, DETAILED_BOM } from '../data/materials';

// Helper to init standard doc
const createDoc = () => {
  const doc = new jsPDF();
  return doc;
};

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

  // Customer Info block
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

  // Group items logic
  const groupedItems: Record<string, CartItem[]> = {};
  order.items.forEach(item => {
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

    const tableBody = items.map(item => {
      let sizeStr = '';
      if (item.selection.gender) sizeStr += `${item.selection.gender === 'Men' ? 'Hombre' : 'Mujer'} - `;
      if (item.selection.waist) {
        sizeStr += `C${item.selection.waist}"`;
        if (item.selection.inseam) {
          sizeStr += ` / L${item.selection.inseam}"`;
        }
      } else if (item.selection.size) {
        sizeStr += item.selection.size;
      }
      return [sizeStr, item.quantity];
    });

    tableBody.push(['SUBTOTAL', items.reduce((s, i) => s + i.quantity, 0)]);

    autoTable(doc, {
      startY: startY,
      head: [['Talla / Opción', 'Cantidad']],
      body: tableBody as any,
      theme: 'striped',
      headStyles: { fillColor: [80, 80, 80] },
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 }
    });

    startY = (doc as any).lastAutoTable.finalY + 10;
  });

  const total = order.items.reduce((s, i) => s + i.quantity, 0);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`TOTAL PIEZAS: ${total}`, 14, startY + 5);

  return doc;
};

export const generateAdminPDF = (order: Order) => {
  const doc = createDoc();
  drawHeader(doc, order, 'ORDEN DE PRODUCCIÓN (ADMIN)');

  let startY = 60;

  // --- 1. Order Summary Table ---
  const tableData = order.items.map(item => {
    let sizeStr = '';
    if (item.selection.gender) sizeStr += `${item.selection.gender === 'Men' ? 'H' : 'M'} `;
    if (item.selection.waist) {
      sizeStr += `${item.selection.waist}`;
      if (item.selection.inseam) sizeStr += `/${item.selection.inseam}`;
    } else if (item.selection.size) {
      sizeStr += item.selection.size;
    }

    return [item.productName, sizeStr, item.quantity];
  });

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Detalle de Pedido", 14, startY);
  startY += 5;

  autoTable(doc, {
    startY: startY,
    head: [['Producto', 'Talla', 'Cant']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [245, 124, 0] },
    margin: { left: 14, right: 14 }
  });

  startY = (doc as any).lastAutoTable.finalY + 15;

  // --- 2. PREP: Identify Product Types for Detailed BOM ---
  const productTypes = new Set<string>();

  order.items.forEach(item => {
    const isShirt = item.productName.toLowerCase().includes('camisa') || item.productName.toLowerCase().includes('shirt') || item.productName.toLowerCase().includes('columbia');
    const type = isShirt ? 'shirt' : 'pant';
    productTypes.add(type);
  });

  // (Summary Table Removed as per user request)


  // --- 3. Detailed Per-Product Unit Costs (Admin Special) ---
  productTypes.forEach(type => {
    const bom = DETAILED_BOM[type];
    if (bom) {
      doc.setFontSize(12);
      doc.setTextColor(230, 81, 0); // specific orange
      doc.text(`Producto: ${bom.label}`, 14, startY);
      startY += 2; // tight fit like image

      const bomBody = bom.items.map(i => [i.name, i.val.toString()]);

      autoTable(doc, {
        startY: startY + 2,
        head: [['Insumos unitarios', 'Cant/Valor']],
        body: bomBody,
        theme: 'grid',
        headStyles: {
          fillColor: [200, 200, 200],
          textColor: [230, 81, 0],
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'center' }
        },
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0]
        },
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;
    }
  });

  return doc;
};

// Renaming for backward compat if needed, or simply export new ones
export const generateOrderPDF = generateCustomerPDF;