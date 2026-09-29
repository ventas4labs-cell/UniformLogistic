import type { Order } from '@/lib/types';
import type { InvoiceRow } from '@/lib/services/invoices';

// ─── Customer dashboard analytics ────────────────────────────────────
//
// Everything here is derived from data the customer home page already
// loads (orders + invoices), so the dashboard costs no extra queries.
// Pure and `now`-injectable so the month windowing can be tested.
//
// Money comes from `invoices` and nothing else. Order lines carry no
// price (see CartItem in lib/types.ts), so an "estimated order value"
// would be invented — the customer sees what was actually billed.

const MONTH_LABELS = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic'
];

/** Month key 'YYYY-MM' straight off an ISO string — no timezone drift. */
const monthKey = (iso: string) => iso.slice(0, 7);

const monthName = (key: string) => MONTH_LABELS[Number(key.slice(5, 7)) - 1] || '';

export interface MonthBucket {
    /** 'YYYY-MM'. */
    key: string;
    /** 'sep' — short Spanish month. */
    label: string;
    /** 'septiembre 2026' — for the bar tooltip. */
    longLabel: string;
    /** Invoiced in that month. */
    spend: number;
    /** Orders placed in that month. */
    orders: number;
    /** Pieces ordered in that month. */
    pieces: number;
}

export interface TopProduct {
    name: string;
    imageUrl?: string;
    pieces: number;
    orders: number;
}

export interface CustomerAnalytics {
    // ── Spending (billed) ──
    totalInvoiced: number;
    totalPaid: number;
    outstanding: number;
    invoiceCount: number;
    /** Average billed per invoice. */
    avgInvoice: number;
    spendThisYear: number;
    /** Spend inside the month window below. */
    spendInWindow: number;

    // ── Volume ──
    totalOrders: number;
    ordersThisYear: number;
    totalPieces: number;
    piecesThisYear: number;
    avgPiecesPerOrder: number;

    /** ISO date of the first order — "cliente desde". */
    firstOrderDate: string | null;

    // ── Series & rankings ──
    months: MonthBucket[];
    topProducts: TopProduct[];
}

const LONG_MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** The last `count` month keys ending at `now`, oldest first. */
function monthWindow(now: Date, count: number): string[] {
    const keys: string[] = [];
    let y = now.getFullYear();
    let m = now.getMonth(); // 0-based
    for (let i = 0; i < count; i++) {
        keys.push(`${y}-${String(m + 1).padStart(2, '0')}`);
        m -= 1;
        if (m < 0) {
            m = 11;
            y -= 1;
        }
    }
    return keys.reverse();
}

export function buildCustomerAnalytics({
    orders,
    invoices,
    now = new Date(),
    monthCount = 12,
    topProductLimit = 5
}: {
    orders: Order[];
    invoices: InvoiceRow[];
    now?: Date;
    monthCount?: number;
    topProductLimit?: number;
}): CustomerAnalytics {
    const thisYear = now.getFullYear();

    // Cancelled orders were never made; drafts and cancelled invoices
    // were never billed. Neither belongs in a spending history.
    const realOrders = orders.filter((o) => o.status !== 'cancelled');
    const realInvoices = invoices.filter(
        (i) => i.status !== 'cancelled' && i.status !== 'draft'
    );

    // ── Spending ──
    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstanding = 0;
    let spendThisYear = 0;
    for (const i of realInvoices) {
        totalInvoiced += i.total;
        totalPaid += i.paidAmount;
        outstanding += i.balance;
        if (Number(i.issuedDate.slice(0, 4)) === thisYear) spendThisYear += i.total;
    }

    // ── Volume ──
    let totalPieces = 0;
    let piecesThisYear = 0;
    let ordersThisYear = 0;
    let firstOrderDate: string | null = null;
    for (const o of realOrders) {
        const pieces = o.items.reduce((s, i) => s + i.quantity, 0);
        totalPieces += pieces;
        if (Number(o.dateCreated.slice(0, 4)) === thisYear) {
            ordersThisYear += 1;
            piecesThisYear += pieces;
        }
        if (!firstOrderDate || o.dateCreated < firstOrderDate) firstOrderDate = o.dateCreated;
    }

    // ── Monthly series ──
    const window = monthWindow(now, monthCount);
    const buckets = new Map<string, MonthBucket>(
        window.map((key) => [
            key,
            {
                key,
                label: monthName(key),
                longLabel: `${LONG_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
                spend: 0,
                orders: 0,
                pieces: 0
            }
        ])
    );
    for (const i of realInvoices) {
        const b = buckets.get(monthKey(i.issuedDate));
        if (b) b.spend += i.total;
    }
    for (const o of realOrders) {
        const b = buckets.get(monthKey(o.dateCreated));
        if (!b) continue;
        b.orders += 1;
        b.pieces += o.items.reduce((s, i) => s + i.quantity, 0);
    }
    const months = window.map((k) => buckets.get(k)!);
    const spendInWindow = months.reduce((s, m) => s + m.spend, 0);

    // ── Most-ordered products ──
    const byProduct = new Map<string, TopProduct & { orderIds: Set<string> }>();
    for (const o of realOrders) {
        for (const it of o.items) {
            const entry = byProduct.get(it.productName) || {
                name: it.productName,
                imageUrl: it.imageUrl,
                pieces: 0,
                orders: 0,
                orderIds: new Set<string>()
            };
            entry.pieces += it.quantity;
            entry.orderIds.add(o.uuid || o.id);
            // Extras join no products row, so the photo can arrive late.
            if (!entry.imageUrl && it.imageUrl) entry.imageUrl = it.imageUrl;
            byProduct.set(it.productName, entry);
        }
    }
    const topProducts: TopProduct[] = Array.from(byProduct.values())
        .map(({ name, imageUrl, pieces, orderIds }) => ({
            name,
            imageUrl,
            pieces,
            orders: orderIds.size
        }))
        .sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name, 'es'))
        .slice(0, topProductLimit);

    return {
        totalInvoiced,
        totalPaid,
        outstanding,
        invoiceCount: realInvoices.length,
        avgInvoice: realInvoices.length > 0 ? totalInvoiced / realInvoices.length : 0,
        spendThisYear,
        spendInWindow,
        totalOrders: realOrders.length,
        ordersThisYear,
        totalPieces,
        piecesThisYear,
        avgPiecesPerOrder:
            realOrders.length > 0 ? Math.round(totalPieces / realOrders.length) : 0,
        firstOrderDate,
        months,
        topProducts
    };
}
