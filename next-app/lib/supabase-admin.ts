// ─── Supabase service-role admin client ──────────────────────────────────
// SERVER-ONLY. Never import this from a client component or route the response
// to the browser — it bypasses RLS using the SUPABASE_SERVICE_ROLE_KEY.

import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
    if (cached) return cached;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');

    cached = createSupabaseClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    return cached;
}
