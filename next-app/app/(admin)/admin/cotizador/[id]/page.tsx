import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { fetchCatalogItems } from '@/lib/services/catalog-items';
import { fetchQuote } from '@/lib/services/quotes';
import { QuoteBuilder } from '@/components/admin/quote-builder';

// Params come in as a Promise in the current Next runtime — awaited
// on demand instead of destructured up top.
export default async function EditQuotePage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const [quote, catalog] = await Promise.all([
        fetchQuote(supabase, id),
        fetchCatalogItems(supabase)
    ]);
    if (!quote) return notFound();
    return <QuoteBuilder catalog={catalog} existing={quote} />;
}
