import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL } from '@/lib/admin-acting-company';
import { computeQuoteTotals, type Quote } from '@/lib/services/quotes';
import { fetchAllInvoicesGroupedByCompany } from '@/lib/services/invoices';
import { sendEmail } from '@/lib/email/send';
import {
    quoteReceivedEmail,
    quoteAdminNotice,
    orderCompletedEmail,
    deliveryScheduledEmail,
    invoiceOverdueEmail,
    type QuoteEmailData
} from '@/lib/email/templates';

const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    !v ? null : Array.isArray(v) ? (v[0] ?? null) : v;

function quoteToEmailData(q: Quote): QuoteEmailData {
    const totals = computeQuoteTotals({
        items: q.items,
        discountPct: q.discountPct,
        taxPct: q.taxPct
    });
    return {
        quoteRef: q.quoteRef,
        clientName: q.clientName,
        companyName: q.companyName,
        currency: q.currency,
        validUntil: q.validUntil,
        items: q.items.map((it) => ({
            name: it.name,
            fabricType: it.fabricType,
            color: it.color,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            pricePerLogo: it.pricePerLogo,
            logoCount: it.logoCount
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        contactEmail: q.contactEmail,
        contactPhone: q.contactPhone
    };
}

/**
 * Customer-submitted quote → auto-reply to the customer + internal
 * notice to the admin. Best-effort: never throws (the quote is already
 * saved; a failed email must not fail the submission).
 */
export async function sendQuoteEmails(quote: Quote): Promise<void> {
    const data = quoteToEmailData(quote);
    try {
        if (data.contactEmail) {
            const t = quoteReceivedEmail(data);
            await sendEmail({ to: data.contactEmail, subject: t.subject, html: t.html, text: t.text });
        }
    } catch (e) {
        console.error('[email] quote customer reply failed', e);
    }
    try {
        const t = quoteAdminNotice(data);
        await sendEmail({ to: ADMIN_EMAIL, subject: t.subject, html: t.html, text: t.text });
    } catch (e) {
        console.error('[email] quote admin notice failed', e);
    }
}

interface OrderEmailRow {
    order_number: number;
    company: { name: string; email: string | null; contact_name: string | null }
        | { name: string; email: string | null; contact_name: string | null }[]
        | null;
    items: { product_name: string; size: string | null; quantity: number }[] | null;
}

/**
 * Order fully delivered → notify the customer. Best-effort; skips
 * silently when the order's company has no email on file.
 */
export async function sendOrderCompletedEmail(
    supabase: SupabaseClient,
    orderUuid: string
): Promise<void> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(
                'order_number, company:companies ( name, email, contact_name ), items:order_items ( product_name, size, quantity )'
            )
            .eq('id', orderUuid)
            .maybeSingle();
        if (error || !data) return;
        const row = data as unknown as OrderEmailRow;
        const company = pickOne(row.company);
        const to = (company?.email || '').trim();
        if (!to) return;

        const items = (row.items || []).map((it) => ({
            productName: it.product_name,
            size: it.size || '',
            quantity: it.quantity
        }));
        const t = orderCompletedEmail({
            orderRef: `ORDEN-${String(row.order_number).padStart(5, '0')}`,
            companyName: company?.name || '',
            contactName: company?.contact_name || '',
            totalPieces: items.reduce((s, i) => s + i.quantity, 0),
            items
        });
        await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
    } catch (e) {
        console.error('[email] order completed notice failed', e);
    }
}

/**
 * Notify the customer that their order is out for / scheduled for
 * delivery. `dateIso` is YYYY-MM-DD. Best-effort — never throws.
 */
export async function sendDeliveryScheduledEmail(
    supabase: SupabaseClient,
    orderUuid: string,
    dateIso: string
): Promise<void> {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('order_number, company:companies ( name, email, contact_name )')
            .eq('id', orderUuid)
            .maybeSingle();
        if (error || !data) return;
        const row = data as unknown as {
            order_number: number;
            company:
                | { name: string; email: string; contact_name: string }
                | { name: string; email: string; contact_name: string }[]
                | null;
        };
        const company = pickOne(row.company);
        const to = (company?.email || '').trim();
        if (!to) return;

        const today = new Date().toISOString().slice(0, 10);
        const isToday = dateIso === today;
        // Format YYYY-MM-DD as a local es-CR date without timezone drift.
        const [y, m, dd] = dateIso.split('-').map((n) => parseInt(n, 10));
        const dateLabel = isToday
            ? 'hoy'
            : `el ${dd}/${m}/${y}`;

        const t = deliveryScheduledEmail({
            orderRef: `ORDEN-${String(row.order_number).padStart(5, '0')}`,
            companyName: company?.name || '',
            contactName: company?.contact_name || '',
            dateLabel,
            isToday
        });
        await sendEmail({ to, subject: t.subject, html: t.html, text: t.text });
    } catch (e) {
        console.error('[email] delivery scheduled notice failed', e);
    }
}

export interface OverdueReminderResult {
    sent: number;
    skippedNoEmail: number;
    failed: number;
    companiesWithOverdue: number;
}

/**
 * Send an overdue-invoice reminder to every company that has at least
 * one overdue invoice with a balance and an email on file.
 */
export async function sendOverdueReminders(
    supabase: SupabaseClient
): Promise<OverdueReminderResult> {
    const groups = await fetchAllInvoicesGroupedByCompany(supabase);

    // Companies that actually owe money past due.
    const targets = groups
        .map((g) => ({
            company: g.company,
            overdue: g.invoices.filter(
                (i) => (i.status === 'overdue' || i.isOverdueByDate) && i.balance > 0
            ),
            currency: 'CRC'
        }))
        .filter((t) => t.overdue.length > 0);

    const result: OverdueReminderResult = {
        sent: 0,
        skippedNoEmail: 0,
        failed: 0,
        companiesWithOverdue: targets.length
    };
    if (targets.length === 0) return result;

    // Resolve company emails in one query.
    const ids = targets.map((t) => t.company.id);
    const { data: emailRows } = await supabase
        .from('companies')
        .select('id, email')
        .in('id', ids);
    const emailById = new Map<string, string>();
    for (const r of (emailRows || []) as { id: string; email: string | null }[]) {
        if (r.email) emailById.set(r.id, r.email.trim());
    }

    for (const t of targets) {
        const to = emailById.get(t.company.id);
        if (!to) {
            result.skippedNoEmail += 1;
            continue;
        }
        const tpl = invoiceOverdueEmail({
            companyName: t.company.name,
            currency: t.currency,
            invoices: t.overdue.map((i) => ({
                invoiceNumber: i.invoiceNumber,
                orderRef: i.orderRef,
                dueDate: i.dueDate,
                balance: i.balance,
                daysOverdue: i.daysOverdue
            })),
            totalOverdue: t.overdue.reduce((s, i) => s + i.balance, 0)
        });
        const res = await sendEmail({ to, subject: tpl.subject, html: tpl.html, text: tpl.text });
        if (res.ok) result.sent += 1;
        else result.failed += 1;
    }

    return result;
}
