import { createClient } from '@/utils/supabase/server';
import { fetchQuotes } from '@/lib/services/quotes';
import { QuotesList } from '@/components/admin/quotes-list';

export default async function CotizadorPage() {
    const supabase = await createClient();
    const quotes = await fetchQuotes(supabase);
    return <QuotesList initialQuotes={quotes} />;
}
