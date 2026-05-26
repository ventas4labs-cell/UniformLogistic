import type { SupabaseClient } from '@supabase/supabase-js';

export type LogoCategory = 'bordado' | 'impresion';

export const LOGO_CATEGORIES: LogoCategory[] = ['bordado', 'impresion'];

export const LOGO_CATEGORY_LABELS: Record<LogoCategory, string> = {
    bordado: 'Bordado',
    impresion: 'Impresión'
};

export interface Logo {
    id: string;
    name: string;
    imageUrl: string;
    category: LogoCategory;
    /**
     * Free-text physical size (e.g. "10 × 6 cm", "3\" diámetro",
     * "8 cm ancho"). Stored as text rather than width/height numbers
     * because shops mix units and conventions.
     */
    size: string;
    notes: string;
    isActive: boolean;
    createdAt: string;
    /** UUIDs of companies the logo is assigned to. */
    companyIds: string[];
}

export interface LogoInput {
    name: string;
    imageUrl: string;
    category: LogoCategory;
    size?: string;
    notes?: string;
    isActive?: boolean;
    /** Reconciled against company_logos on save when provided. */
    companyIds?: string[];
}

interface LogoRow {
    id: string;
    name: string;
    image_url: string | null;
    category: LogoCategory;
    size: string | null;
    notes: string | null;
    is_active: boolean | null;
    created_at: string;
}

interface LogoRowWithLinks extends LogoRow {
    links: { company_id: string }[] | null;
}

const mapRow = (r: LogoRow, companyIds: string[] = []): Logo => ({
    id: r.id,
    name: r.name,
    imageUrl: r.image_url || '',
    category: r.category,
    size: r.size || '',
    notes: r.notes || '',
    isActive: r.is_active !== false,
    createdAt: r.created_at,
    companyIds
});

const SELECT = 'id, name, image_url, category, size, notes, is_active, created_at';

export const fetchLogos = async (
    supabase: SupabaseClient
): Promise<Logo[]> => {
    const { data, error } = await supabase
        .from('logos')
        .select(`${SELECT}, links:company_logos ( company_id )`)
        .order('name', { ascending: true });
    if (error) throw error;
    return (data as unknown as LogoRowWithLinks[]).map((r) =>
        mapRow(r, (r.links || []).map((l) => l.company_id))
    );
};

const reconcileCompanyAssignments = async (
    supabase: SupabaseClient,
    logoId: string,
    companyIds: string[]
): Promise<void> => {
    const { data: existing, error: fetchErr } = await supabase
        .from('company_logos')
        .select('company_id')
        .eq('logo_id', logoId);
    if (fetchErr) throw fetchErr;
    const current = new Set((existing || []).map((r) => r.company_id as string));
    const wanted = new Set(companyIds);
    const toAdd = [...wanted].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !wanted.has(id));
    if (toAdd.length > 0) {
        const { error } = await supabase.from('company_logos').insert(
            toAdd.map((company_id) => ({
                company_id,
                logo_id: logoId,
                is_active: true
            }))
        );
        if (error && !/duplicate/i.test(error.message)) throw error;
    }
    if (toRemove.length > 0) {
        const { error } = await supabase
            .from('company_logos')
            .delete()
            .eq('logo_id', logoId)
            .in('company_id', toRemove);
        if (error) throw error;
    }
};

export const createLogo = async (
    supabase: SupabaseClient,
    input: LogoInput
): Promise<Logo> => {
    const { data, error } = await supabase
        .from('logos')
        .insert({
            name: input.name,
            image_url: input.imageUrl || null,
            category: input.category,
            size: input.size?.trim() || null,
            notes: input.notes || null,
            is_active: input.isActive ?? true
        })
        .select(SELECT)
        .single();
    if (error) throw error;
    const row = data as LogoRow;
    if (input.companyIds) {
        await reconcileCompanyAssignments(supabase, row.id, input.companyIds);
    }
    return mapRow(row, input.companyIds || []);
};

export const updateLogo = async (
    supabase: SupabaseClient,
    id: string,
    input: LogoInput
): Promise<Logo> => {
    const { data, error } = await supabase
        .from('logos')
        .update({
            name: input.name,
            image_url: input.imageUrl || null,
            category: input.category,
            size: input.size?.trim() || null,
            notes: input.notes || null,
            is_active: input.isActive ?? true
        })
        .eq('id', id)
        .select(SELECT)
        .single();
    if (error) throw error;
    if (input.companyIds) {
        await reconcileCompanyAssignments(supabase, id, input.companyIds);
    }
    return mapRow(data as LogoRow, input.companyIds);
};

export const deleteLogo = async (
    supabase: SupabaseClient,
    id: string
): Promise<void> => {
    const { error } = await supabase.from('logos').delete().eq('id', id);
    if (error) throw error;
};

const slugifyName = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'logo';

// Reuses the existing product-images bucket under a logos/ prefix so
// we don't need a second bucket with duplicate RLS policies.
export const uploadLogoImage = async (
    supabase: SupabaseClient,
    file: File
): Promise<string> => {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const base = slugifyName(file.name.replace(/\.[^.]+$/, ''));
    const path = `logos/${base}-${Date.now()}.${ext}`;
    const buffer = await file.arrayBuffer();
    const { error } = await supabase.storage
        .from('product-images')
        .upload(path, new Uint8Array(buffer), {
            upsert: false,
            contentType: file.type || 'image/png'
        });
    if (error) throw error;
    const { data } = supabase.storage.from('product-images').getPublicUrl(path);
    return data.publicUrl;
};
