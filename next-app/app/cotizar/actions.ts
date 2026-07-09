'use server';

import { createServiceClient } from '@/utils/supabase/server';
import { createQuote, type QuoteLineInput } from '@/lib/services/quotes';
import { sendQuoteEmails } from '@/lib/email/notifications';

export interface CustomerContact {
    clientName: string;
    companyName: string;
    email: string;
    phone: string;
    notes: string;
}

export interface SubmitResult {
    ok: boolean;
    quoteId?: string;
    quoteRef?: string;
    error?: string;
}

// Public endpoint: a logged-out visitor submits their configured quote.
// Uses the service-role client because the visitor is unauthenticated
// (RLS on quotes/quote_items is authenticated-only). Runs server-side
// only, so the key never reaches the browser. The quote is stored with
// source='customer' + status='sent' so it lands in the admin Cotizador
// as an incoming lead.
export async function submitCustomerQuoteAction(
    contact: CustomerContact,
    items: QuoteLineInput[]
): Promise<SubmitResult> {
    // Validate server-side — never trust the client payload.
    if (!items || items.length === 0) {
        return { ok: false, error: 'Agregá al menos un producto a tu cotización.' };
    }
    if (!contact.email.trim() && !contact.phone.trim()) {
        return {
            ok: false,
            error: 'Dejanos un correo o teléfono para poder responderte.'
        };
    }
    const cleanItems = items
        .filter((it) => it.name && it.quantity > 0)
        .map((it) => ({
            ...it,
            quantity: Math.max(1, Math.floor(it.quantity)),
            logoCount: Math.max(0, Math.floor(it.logoCount ?? 0)),
            unitPrice: Math.max(0, it.unitPrice),
            pricePerLogo: Math.max(0, it.pricePerLogo ?? 0)
        }));
    if (cleanItems.length === 0) {
        return { ok: false, error: 'Los productos de la cotización no son válidos.' };
    }

    try {
        const supabase = createServiceClient();
        const quote = await createQuote(
            supabase,
            {
                source: 'customer',
                status: 'sent',
                clientName: contact.clientName.trim() || undefined,
                companyName: contact.companyName.trim() || undefined,
                contactEmail: contact.email.trim() || undefined,
                contactPhone: contact.phone.trim() || undefined,
                notes: contact.notes.trim() || undefined,
                discountPct: 0,
                taxPct: 13,
                currency: 'CRC'
            },
            cleanItems,
            null
        );
        // Auto-reply to the customer + notify the admin. Best-effort:
        // sendQuoteEmails never throws, so a mail hiccup can't fail the
        // already-saved quote.
        await sendQuoteEmails(quote);
        return { ok: true, quoteId: quote.id, quoteRef: quote.quoteRef };
    } catch (e) {
        return {
            ok: false,
            error:
                e instanceof Error
                    ? e.message
                    : 'No pudimos enviar la cotización. Intentá de nuevo.'
        };
    }
}
