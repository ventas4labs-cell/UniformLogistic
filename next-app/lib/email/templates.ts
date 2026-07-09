// ─── Branded customer-facing email templates ─────────────────────────
// Pure builders — each returns { subject, html, text }. Table-based
// layout + inline styles for broad email-client compatibility. All
// interpolated values are HTML-escaped (esc) since they include
// customer-provided data (names, notes).

const ORANGE = '#EA580C';
const INK = '#16130F';
const IVORY = '#F7F4EE';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

const SUPPORT_EMAIL = 'ulogisticcr@gmail.com';

export interface RenderedEmail {
    subject: string;
    html: string;
    text: string;
}

export function esc(s: unknown): string {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const money = (n: number, currency = 'CRC') =>
    new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0
    }).format(n);

const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? esc(iso) : d.toLocaleDateString('es-CR');
};

// Shared shell: orange header, white body, muted footer.
function layout(opts: { title: string; preheader?: string; body: string; cta?: { label: string; href: string } }): string {
    const cta = opts.cta
        ? `<tr><td style="padding:8px 32px 24px 32px;">
             <a href="${esc(opts.cta.href)}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px;">${esc(opts.cta.label)}</a>
           </td></tr>`
        : '';
    return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:${IVORY};font-family:Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${esc(opts.preheader || opts.title)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
        <tr><td style="background:${ORANGE};padding:22px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.5px;">UNIFORM LOGISTIC</span>
          <span style="color:#ffffff;opacity:0.85;font-size:11px;display:block;margin-top:2px;letter-spacing:1px;text-transform:uppercase;">Manufactura textil de uniformes</span>
        </td></tr>
        <tr><td style="padding:28px 32px 8px 32px;">
          <h1 style="margin:0 0 4px 0;font-size:22px;font-weight:800;color:${INK};">${esc(opts.title)}</h1>
        </td></tr>
        <tr><td style="padding:8px 32px 4px 32px;font-size:15px;line-height:1.6;color:#374151;">${opts.body}</td></tr>
        ${cta}
        <tr><td style="padding:20px 32px;border-top:1px solid ${BORDER};">
          <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.6;">
            Uniform Logistic · San José, Costa Rica<br>
            <a href="mailto:${SUPPORT_EMAIL}" style="color:${ORANGE};text-decoration:none;">${SUPPORT_EMAIL}</a>
          </p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0 0;font-size:11px;color:${MUTED};">Este correo se envió automáticamente. Respondé si necesitás ayuda.</p>
    </td></tr>
  </table>
</body></html>`;
}

// A reusable line-items table (used by quote + order emails).
function itemsTable(
    rows: { left: string; sub?: string; right: string }[]
): string {
    const body = rows
        .map(
            (r) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:${INK};">
          <strong>${r.left}</strong>${r.sub ? `<br><span style="font-size:12px;color:${MUTED};">${r.sub}</span>` : ''}
        </td>
        <td style="padding:9px 0;border-bottom:1px solid ${BORDER};font-size:14px;color:${INK};text-align:right;white-space:nowrap;">${r.right}</td>
      </tr>`
        )
        .join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">${body}</table>`;
}

// ── 1. Quote received — to the customer ──────────────────────────────
export interface QuoteEmailData {
    quoteRef: string;
    clientName: string;
    companyName: string;
    currency: string;
    validUntil: string | null;
    items: {
        name: string;
        fabricType: string;
        color: string;
        quantity: number;
        unitPrice: number;
        pricePerLogo: number;
        logoCount: number;
    }[];
    subtotal: number;
    tax: number;
    total: number;
    contactEmail: string;
    contactPhone: string;
}

export function quoteReceivedEmail(q: QuoteEmailData): RenderedEmail {
    const greet = q.clientName || q.companyName;
    const rows = q.items.map((it) => {
        const effUnit = it.unitPrice + it.pricePerLogo * it.logoCount;
        const spec = [it.fabricType, it.color, it.logoCount > 0 ? `${it.logoCount} logo${it.logoCount === 1 ? '' : 's'}` : '']
            .filter(Boolean)
            .map(esc)
            .join(' · ');
        return {
            left: esc(it.name),
            sub: `${spec ? spec + ' · ' : ''}${it.quantity} × ${money(effUnit, q.currency)}`,
            right: money(effUnit * it.quantity, q.currency)
        };
    });
    const body = `
    <p style="margin:0 0 14px 0;">${greet ? `Hola ${esc(greet)},` : 'Hola,'}</p>
    <p style="margin:0 0 14px 0;">Recibimos tu solicitud de cotización <strong style="color:${ORANGE};">${esc(q.quoteRef)}</strong>. Nuestro equipo la está revisando y te contactará pronto con la propuesta final.</p>
    ${itemsTable(rows)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
      <tr><td style="font-size:14px;color:${MUTED};padding:3px 0;">Subtotal</td><td style="font-size:14px;text-align:right;color:${INK};">${money(q.subtotal, q.currency)}</td></tr>
      <tr><td style="font-size:14px;color:${MUTED};padding:3px 0;">IVA</td><td style="font-size:14px;text-align:right;color:${INK};">${money(q.tax, q.currency)}</td></tr>
      <tr><td style="font-size:16px;font-weight:800;color:${INK};padding-top:8px;border-top:2px solid ${INK};">Total estimado</td><td style="font-size:16px;font-weight:800;text-align:right;color:${ORANGE};padding-top:8px;border-top:2px solid ${INK};">${money(q.total, q.currency)}</td></tr>
    </table>
    ${q.validUntil ? `<p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Válida hasta ${fmtDate(q.validUntil)}.</p>` : ''}
    <p style="margin:14px 0 0 0;font-size:13px;color:${MUTED};">Los montos son una estimación y pueden ajustarse según tallas, telas y cantidades finales.</p>`;
    return {
        subject: `Recibimos tu cotización ${q.quoteRef} — Uniform Logistic`,
        html: layout({ title: 'Cotización recibida', preheader: `Tu cotización ${q.quoteRef} está en revisión`, body }),
        text:
            `${greet ? `Hola ${greet},\n\n` : ''}Recibimos tu cotización ${q.quoteRef}. Nuestro equipo la revisará y te contactará pronto.\n\n` +
            q.items
                .map((it) => {
                    const effUnit = it.unitPrice + it.pricePerLogo * it.logoCount;
                    return `- ${it.name} · ${it.quantity} × ${money(effUnit, q.currency)} = ${money(effUnit * it.quantity, q.currency)}`;
                })
                .join('\n') +
            `\n\nTotal estimado: ${money(q.total, q.currency)}\n\nUniform Logistic · ${SUPPORT_EMAIL}`
    };
}

// ── 2. New quote — internal notice to the admin ──────────────────────
export function quoteAdminNotice(q: QuoteEmailData): RenderedEmail {
    const totalPieces = q.items.reduce((s, i) => s + i.quantity, 0);
    const rows = q.items.map((it) => ({
        left: esc(it.name),
        sub: [it.fabricType, it.color].filter(Boolean).map(esc).join(' · '),
        right: `${it.quantity} pzas`
    }));
    const contact = [q.contactEmail, q.contactPhone].filter(Boolean).map(esc).join(' · ');
    const body = `
    <p style="margin:0 0 14px 0;">Un cliente envió una nueva cotización desde el sitio.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};border-radius:10px;padding:12px 16px;margin-bottom:8px;">
      <tr><td style="font-size:14px;color:${INK};padding:2px 0;"><strong>${esc(q.quoteRef)}</strong> · ${money(q.total, q.currency)}</td></tr>
      <tr><td style="font-size:13px;color:${MUTED};padding:2px 0;">${esc(q.companyName || '—')}${q.clientName ? ` · ${esc(q.clientName)}` : ''}</td></tr>
      ${contact ? `<tr><td style="font-size:13px;color:${MUTED};padding:2px 0;">${contact}</td></tr>` : ''}
      <tr><td style="font-size:13px;color:${MUTED};padding:2px 0;">${totalPieces} piezas · ${q.items.length} líneas</td></tr>
    </table>
    ${itemsTable(rows)}`;
    return {
        subject: `Nueva cotización ${q.quoteRef} — ${q.companyName || q.clientName || 'cliente'}`,
        html: layout({ title: 'Nueva cotización de cliente', preheader: `${q.quoteRef} · ${money(q.total, q.currency)}`, body }),
        text: `Nueva cotización ${q.quoteRef}\nCliente: ${q.companyName || ''} ${q.clientName || ''}\nContacto: ${q.contactEmail || ''} ${q.contactPhone || ''}\nTotal: ${money(q.total, q.currency)} · ${totalPieces} piezas`
    };
}

// ── 3. Order completed / delivered — to the customer ─────────────────
export interface OrderCompletedEmailData {
    orderRef: string;
    companyName: string;
    contactName: string;
    totalPieces: number;
    items: { productName: string; size: string; quantity: number }[];
}

export function orderCompletedEmail(o: OrderCompletedEmailData): RenderedEmail {
    const greet = o.contactName || o.companyName;
    const rows = o.items.map((it) => ({
        left: esc(it.productName),
        sub: esc(it.size),
        right: `× ${it.quantity}`
    }));
    const body = `
    <p style="margin:0 0 14px 0;">${greet ? `Hola ${esc(greet)},` : 'Hola,'}</p>
    <p style="margin:0 0 6px 0;">¡Buenas noticias! Tu pedido <strong style="color:${ORANGE};">${esc(o.orderRef)}</strong> está <strong>completado y entregado</strong>.</p>
    <p style="margin:0 0 8px 0;color:${MUTED};font-size:14px;">${o.totalPieces} pieza${o.totalPieces === 1 ? '' : 's'} en ${o.items.length} artículo${o.items.length === 1 ? '' : 's'}:</p>
    ${itemsTable(rows)}
    <p style="margin:14px 0 0 0;">Gracias por confiar en Uniform Logistic. Si necesitás una reposición o un nuevo pedido, estamos a la orden.</p>`;
    return {
        subject: `Tu pedido ${o.orderRef} fue entregado — Uniform Logistic`,
        html: layout({ title: 'Pedido entregado', preheader: `${o.orderRef} está completo`, body }),
        text:
            `${greet ? `Hola ${greet},\n\n` : ''}Tu pedido ${o.orderRef} está completado y entregado.\n\n` +
            o.items.map((it) => `- ${it.productName} ${it.size ? `(${it.size})` : ''} × ${it.quantity}`).join('\n') +
            `\n\nGracias por confiar en Uniform Logistic.\n${SUPPORT_EMAIL}`
    };
}

// ── 4. Overdue invoices reminder — to the customer ───────────────────
export interface OverdueEmailData {
    companyName: string;
    currency: string;
    invoices: {
        invoiceNumber: string;
        orderRef: string | null;
        dueDate: string;
        balance: number;
        daysOverdue: number;
    }[];
    totalOverdue: number;
}

export function invoiceOverdueEmail(d: OverdueEmailData): RenderedEmail {
    const rows = d.invoices.map((inv) => ({
        left: `Factura ${esc(inv.invoiceNumber)}`,
        sub: `${inv.orderRef ? esc(inv.orderRef) + ' · ' : ''}Venció ${fmtDate(inv.dueDate)} · ${inv.daysOverdue} día${inv.daysOverdue === 1 ? '' : 's'}`,
        right: money(inv.balance, d.currency)
    }));
    const body = `
    <p style="margin:0 0 14px 0;">${d.companyName ? `Estimados ${esc(d.companyName)},` : 'Estimados,'}</p>
    <p style="margin:0 0 14px 0;">Le recordamos que tiene ${d.invoices.length} factura${d.invoices.length === 1 ? '' : 's'} pendiente${d.invoices.length === 1 ? '' : 's'} de pago con Uniform Logistic:</p>
    ${itemsTable(rows)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:16px;font-weight:800;color:${INK};padding-top:8px;border-top:2px solid ${INK};">Total vencido</td><td style="font-size:16px;font-weight:800;text-align:right;color:#dc2626;padding-top:8px;border-top:2px solid ${INK};">${money(d.totalOverdue, d.currency)}</td></tr>
    </table>
    <p style="margin:16px 0 0 0;">Agradecemos regularizar el pago a la brevedad. Si ya realizaste el pago o tenés alguna consulta, escribinos a <a href="mailto:${SUPPORT_EMAIL}" style="color:${ORANGE};text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>`;
    return {
        subject: `Recordatorio de pago — ${d.invoices.length} factura${d.invoices.length === 1 ? '' : 's'} vencida${d.invoices.length === 1 ? '' : 's'}`,
        html: layout({ title: 'Facturas pendientes de pago', preheader: `Total vencido: ${money(d.totalOverdue, d.currency)}`, body }),
        text:
            `${d.companyName ? `Estimados ${d.companyName},\n\n` : ''}Tiene ${d.invoices.length} factura(s) vencida(s):\n\n` +
            d.invoices
                .map((inv) => `- Factura ${inv.invoiceNumber} — vence ${fmtDate(inv.dueDate)} (${inv.daysOverdue} días) — ${money(inv.balance, d.currency)}`)
                .join('\n') +
            `\n\nTotal vencido: ${money(d.totalOverdue, d.currency)}\n\nUniform Logistic · ${SUPPORT_EMAIL}`
    };
}
