import type { SupabaseClient } from '@supabase/supabase-js';
import type { SizeSelection } from '@/lib/types';

// ─── 3D models + custom design requests ─────────────────────────────
// Models are ingested by `npm run sync:3d` (uploads the .glb + inserts
// the row); the admin edits metadata here (name, zones, company
// assignment, placement toggle). Customers open /custom-order, place
// their company logos on the preset zones, and submit a design request.

export type ThreeDProductType = 'shirt' | 'pant' | 'other';

// A preset logo anchor authored in the admin zone editor. Coordinates
// are in the model's local space; a drei <Decal> is projected here.
export interface ZoneDef {
    id: string;
    label: string;
    position: [number, number, number];
    normal: [number, number, number];
    rotation: [number, number, number];
    scale: number;
}

export interface ThreeDModel {
    id: string;
    code: string;
    name: string;
    description: string;
    modelUrl: string;
    posterUrl: string;
    productType: ThreeDProductType;
    allowLogoPlacement: boolean;
    zones: ZoneDef[];
    isActive: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    /** Company UUIDs this model is assigned to (admin view only). */
    companyIds: string[];
    /** Linked real product (for turning a design request into an order). */
    productId: string | null;
    productCode: string;
    productName: string;
    /** Whether the customer may upload their own artwork for a zone. */
    allowCustomLogo: boolean;
}

export interface ThreeDModelInput {
    name?: string;
    description?: string;
    productType?: ThreeDProductType;
    allowLogoPlacement?: boolean;
    allowCustomLogo?: boolean;
    /** products.id to link, or null to unlink. */
    productId?: string | null;
    zones?: ZoneDef[];
    isActive?: boolean;
    sortOrder?: number;
    /** When provided, reconcile the company_three_d_models assignments. */
    companyIds?: string[];
}

interface ModelRow {
    id: string;
    code: string;
    name: string;
    description: string | null;
    model_url: string;
    poster_url: string | null;
    product_type: string;
    allow_logo_placement: boolean;
    allow_custom_logo: boolean | null;
    product_id: string | null;
    product: { product_code: string; name: string } | { product_code: string; name: string }[] | null;
    zones: ZoneDef[] | null;
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    links?: { id: string; company_id: string }[] | null;
}

const asProductType = (t: string): ThreeDProductType =>
    t === 'pant' || t === 'other' ? t : 'shirt';

const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const mapModel = (r: ModelRow): ThreeDModel => {
    const product = one(r.product);
    return {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description || '',
        modelUrl: r.model_url,
        posterUrl: r.poster_url || '',
        productType: asProductType(r.product_type),
        allowLogoPlacement: r.allow_logo_placement,
        allowCustomLogo: r.allow_custom_logo !== false,
        zones: Array.isArray(r.zones) ? r.zones : [],
        isActive: r.is_active,
        sortOrder: r.sort_order,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        companyIds: (r.links || []).map((l) => l.company_id),
        productId: r.product_id,
        productCode: product?.product_code || '',
        productName: product?.name || ''
    };
};

const MODEL_SELECT = `
    id, code, name, description, model_url, poster_url, product_type,
    allow_logo_placement, allow_custom_logo, product_id, zones, is_active,
    sort_order, created_at, updated_at,
    product:products ( product_code, name ),
    links:company_three_d_models ( id, company_id )
`;

// ── Admin reads/writes ──────────────────────────────────────────────
export async function fetchThreeDModels(
    supabase: SupabaseClient
): Promise<ThreeDModel[]> {
    const { data, error } = await supabase
        .from('three_d_models')
        .select(MODEL_SELECT)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
    if (error) throw error;
    return ((data || []) as unknown as ModelRow[]).map(mapModel);
}

export async function updateThreeDModel(
    supabase: SupabaseClient,
    id: string,
    input: ThreeDModelInput
): Promise<void> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.productType !== undefined) patch.product_type = input.productType;
    if (input.allowLogoPlacement !== undefined) patch.allow_logo_placement = input.allowLogoPlacement;
    if (input.allowCustomLogo !== undefined) patch.allow_custom_logo = input.allowCustomLogo;
    if (input.productId !== undefined) patch.product_id = input.productId;
    if (input.zones !== undefined) patch.zones = input.zones;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

    const { error } = await supabase.from('three_d_models').update(patch).eq('id', id);
    if (error) throw error;

    if (input.companyIds !== undefined) {
        await reconcileCompanyAssignments(supabase, id, input.companyIds);
    }
}

export async function deleteThreeDModel(
    supabase: SupabaseClient,
    id: string
): Promise<void> {
    const { error } = await supabase.from('three_d_models').delete().eq('id', id);
    if (error) throw error;
}

// ── Per-company assignment (mirror company_products) ─────────────────
export async function setModelAssignment(
    supabase: SupabaseClient,
    companyId: string,
    modelId: string,
    assigned: boolean
): Promise<void> {
    if (assigned) {
        const { error } = await supabase
            .from('company_three_d_models')
            .insert({ company_id: companyId, model_id: modelId, is_active: true });
        if (error && !/duplicate/i.test(error.message)) throw error;
    } else {
        const { error } = await supabase
            .from('company_three_d_models')
            .delete()
            .eq('company_id', companyId)
            .eq('model_id', modelId);
        if (error) throw error;
    }
}

export async function reconcileCompanyAssignments(
    supabase: SupabaseClient,
    modelId: string,
    companyIds: string[]
): Promise<void> {
    const { data: current, error } = await supabase
        .from('company_three_d_models')
        .select('company_id')
        .eq('model_id', modelId);
    if (error) throw error;

    const have = new Set((current || []).map((r: { company_id: string }) => r.company_id));
    const want = new Set(companyIds);
    const toAdd = companyIds.filter((c) => !have.has(c));
    const toRemove = [...have].filter((c) => !want.has(c));

    if (toAdd.length > 0) {
        const rows = toAdd.map((company_id) => ({ company_id, model_id: modelId, is_active: true }));
        const { error: aErr } = await supabase.from('company_three_d_models').insert(rows);
        if (aErr && !/duplicate/i.test(aErr.message)) throw aErr;
    }
    if (toRemove.length > 0) {
        const { error: rErr } = await supabase
            .from('company_three_d_models')
            .delete()
            .eq('model_id', modelId)
            .in('company_id', toRemove);
        if (rErr) throw rErr;
    }
}

export async function fetchModelById(
    supabase: SupabaseClient,
    id: string
): Promise<ThreeDModel | null> {
    const { data, error } = await supabase
        .from('three_d_models')
        .select(MODEL_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data ? mapModel(data as unknown as ModelRow) : null;
}

// The active 3D model linked to a product (basic items reach the studio
// through their product, not via a company_three_d_models assignment).
export async function fetchModelByProductId(
    supabase: SupabaseClient,
    productId: string
): Promise<ThreeDModel | null> {
    const { data, error } = await supabase
        .from('three_d_models')
        .select(MODEL_SELECT)
        .eq('product_id', productId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data ? mapModel(data as unknown as ModelRow) : null;
}

// Active models linked to a set of products, keyed by product id. Used
// by the catalog to attach each basic product's 3D model.
export async function fetchModelsForProductIds(
    supabase: SupabaseClient,
    productIds: string[]
): Promise<Record<string, ThreeDModel>> {
    const out: Record<string, ThreeDModel> = {};
    if (productIds.length === 0) return out;
    const { data, error } = await supabase
        .from('three_d_models')
        .select(MODEL_SELECT)
        .in('product_id', productIds)
        .eq('is_active', true);
    if (error) throw error;
    for (const r of (data || []) as unknown as ModelRow[]) {
        const m = mapModel(r);
        if (m.productId) out[m.productId] = m;
    }
    return out;
}

// ── Customer-facing scoping ─────────────────────────────────────────
export async function fetchModelsForCompany(
    supabase: SupabaseClient,
    companyId: string
): Promise<ThreeDModel[]> {
    const { data, error } = await supabase
        .from('company_three_d_models')
        .select(`model:three_d_models ( ${MODEL_SELECT} )`)
        .eq('company_id', companyId)
        .eq('is_active', true);
    if (error) throw error;
    return ((data || []) as unknown as { model: ModelRow | null }[])
        .map((r) => r.model)
        .filter((m): m is ModelRow => !!m && m.is_active)
        .map(mapModel)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

// ── Design requests ─────────────────────────────────────────────────
export type DesignStatus = 'sent' | 'reviewed' | 'converted' | 'archived';

export const formatDesignRef = (n: number) => `DIS-${String(n).padStart(5, '0')}`;

export interface DesignLogo {
    id: string;
    zoneId: string;
    zoneLabel: string;
    logoId: string | null;
    logoImageUrl: string;
    logoName: string;
}

// One size line the customer chose (drives the order on accept).
export interface DesignItem {
    size: string; // display label, e.g. "H · M"
    quantity: number;
    selection: SizeSelection;
}

export interface DesignRequest {
    id: string;
    requestNumber: number;
    requestRef: string;
    companyId: string | null;
    companyName: string;
    modelId: string | null;
    modelName: string;
    /** Linked product snapshot (for creating the order). */
    productCode: string;
    productName: string;
    status: DesignStatus;
    colorName: string;
    notes: string;
    previewUrl: string;
    createdAt: string;
    items: DesignItem[];
    logos: DesignLogo[];
}

export interface DesignLogoInput {
    zoneId: string;
    zoneLabel: string;
    logoId: string | null;
    logoImageUrl?: string;
    logoName?: string;
}

export interface DesignRequestInput {
    companyId: string | null;
    modelId: string | null;
    modelName?: string;
    productId?: string | null;
    productCode?: string;
    productName?: string;
    colorName?: string;
    notes?: string;
    previewUrl?: string;
    items?: DesignItem[];
}

interface DesignRow {
    id: string;
    request_number: number;
    company_id: string | null;
    model_id: string | null;
    model_name: string | null;
    product_code: string | null;
    product_name: string | null;
    status: string;
    color_name: string | null;
    notes: string | null;
    preview_url: string | null;
    items: DesignItem[] | null;
    created_at: string;
    company?: { name: string } | { name: string }[] | null;
    logos?: {
        id: string;
        zone_id: string | null;
        zone_label: string | null;
        logo_id: string | null;
        logo_image_url: string | null;
        logo_name: string | null;
    }[] | null;
}

const pickOne = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

const mapDesign = (r: DesignRow): DesignRequest => ({
    id: r.id,
    requestNumber: r.request_number,
    requestRef: formatDesignRef(r.request_number),
    companyId: r.company_id,
    companyName: pickOne(r.company)?.name || '',
    modelId: r.model_id,
    modelName: r.model_name || '',
    productCode: r.product_code || '',
    productName: r.product_name || '',
    status: (r.status as DesignStatus) || 'sent',
    colorName: r.color_name || '',
    notes: r.notes || '',
    previewUrl: r.preview_url || '',
    createdAt: r.created_at,
    items: Array.isArray(r.items) ? r.items : [],
    logos: (r.logos || []).map((l) => ({
        id: l.id,
        zoneId: l.zone_id || '',
        zoneLabel: l.zone_label || '',
        logoId: l.logo_id,
        logoImageUrl: l.logo_image_url || '',
        logoName: l.logo_name || ''
    }))
});

const DESIGN_SELECT = `
    id, request_number, company_id, model_id, model_name, product_code, product_name,
    status, color_name, notes, preview_url, items, created_at,
    company:companies ( name ),
    logos:custom_design_logos ( id, zone_id, zone_label, logo_id, logo_image_url, logo_name )
`;

export async function fetchDesignRequests(
    supabase: SupabaseClient
): Promise<DesignRequest[]> {
    const { data, error } = await supabase
        .from('custom_design_requests')
        .select(DESIGN_SELECT)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as unknown as DesignRow[]).map(mapDesign);
}

export async function fetchDesignRequest(
    supabase: SupabaseClient,
    id: string
): Promise<DesignRequest | null> {
    const { data, error } = await supabase
        .from('custom_design_requests')
        .select(DESIGN_SELECT)
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data ? mapDesign(data as unknown as DesignRow) : null;
}

export async function createDesignRequest(
    supabase: SupabaseClient,
    header: DesignRequestInput,
    logos: DesignLogoInput[],
    createdBy: string | null
): Promise<{ id: string; requestRef: string; requestNumber: number }> {
    const { data: created, error: hErr } = await supabase
        .from('custom_design_requests')
        .insert({
            company_id: header.companyId,
            created_by: createdBy,
            model_id: header.modelId,
            model_name: header.modelName ?? null,
            product_id: header.productId ?? null,
            product_code: header.productCode ?? null,
            product_name: header.productName ?? null,
            status: 'sent',
            color_name: header.colorName ?? null,
            notes: header.notes ?? null,
            preview_url: header.previewUrl ?? null,
            items: header.items ?? []
        })
        .select('id, request_number')
        .single();
    if (hErr) throw hErr;

    if (logos.length > 0) {
        const rows = logos.map((l) => ({
            request_id: created.id,
            zone_id: l.zoneId,
            zone_label: l.zoneLabel,
            logo_id: l.logoId,
            logo_image_url: l.logoImageUrl ?? null,
            logo_name: l.logoName ?? null
        }));
        const { error: lErr } = await supabase.from('custom_design_logos').insert(rows);
        if (lErr) {
            // Roll back the header so we don't leave a childless ghost.
            await supabase.from('custom_design_requests').delete().eq('id', created.id);
            throw lErr;
        }
    }

    return {
        id: created.id,
        requestNumber: created.request_number,
        requestRef: formatDesignRef(created.request_number)
    };
}

export async function updateDesignRequestStatus(
    supabase: SupabaseClient,
    id: string,
    status: DesignStatus
): Promise<void> {
    const { error } = await supabase
        .from('custom_design_requests')
        .update({ status })
        .eq('id', id);
    if (error) throw error;
}
