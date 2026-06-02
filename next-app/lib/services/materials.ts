import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Materiales / insumos inventory ──────────────────────────────────
// Raw materials admin buys, stores in the warehouse, and consumes in
// production. Names match what's stored on each product's bom_json so
// the same insumo string the admin types into a product BOM lines up
// with a row here.

export interface Material {
    id: string;
    name: string;
    unit: string;
    category: string;
    currentQty: number;
    minQty: number;
    unitCost: number;
    supplier: string;
    notes: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface MaterialInput {
    name: string;
    unit: string;
    category?: string;
    currentQty?: number;
    minQty?: number;
    unitCost?: number;
    supplier?: string;
    notes?: string;
    isActive?: boolean;
}

interface RawRow {
    id: string;
    name: string;
    unit: string;
    category: string | null;
    current_qty: number | string;
    min_qty: number | string;
    unit_cost: number | string;
    supplier: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const SELECT =
    'id, name, unit, category, current_qty, min_qty, unit_cost, supplier, notes, is_active, created_at, updated_at';

const num = (v: number | string): number =>
    typeof v === 'string' ? parseFloat(v) : v;

const mapRow = (r: RawRow): Material => ({
    id: r.id,
    name: r.name,
    unit: r.unit || 'unidad',
    category: r.category || '',
    currentQty: num(r.current_qty),
    minQty: num(r.min_qty),
    unitCost: num(r.unit_cost),
    supplier: r.supplier || '',
    notes: r.notes || '',
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at
});

export async function fetchMaterials(
    supabase: SupabaseClient
): Promise<Material[]> {
    const { data, error } = await supabase
        .from('materials')
        .select(SELECT)
        .order('name', { ascending: true });
    if (error) throw error;
    return ((data || []) as RawRow[]).map(mapRow);
}

export async function createMaterial(
    supabase: SupabaseClient,
    input: MaterialInput
): Promise<Material> {
    const { data, error } = await supabase
        .from('materials')
        .insert({
            name: input.name.trim(),
            unit: input.unit.trim() || 'unidad',
            category: input.category?.trim() || null,
            current_qty: input.currentQty ?? 0,
            min_qty: input.minQty ?? 0,
            unit_cost: input.unitCost ?? 0,
            supplier: input.supplier?.trim() || null,
            notes: input.notes?.trim() || null,
            is_active: input.isActive ?? true
        })
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

export async function updateMaterial(
    supabase: SupabaseClient,
    id: string,
    input: MaterialInput
): Promise<Material> {
    const { data, error } = await supabase
        .from('materials')
        .update({
            name: input.name.trim(),
            unit: input.unit.trim() || 'unidad',
            category: input.category?.trim() || null,
            current_qty: input.currentQty ?? 0,
            min_qty: input.minQty ?? 0,
            unit_cost: input.unitCost ?? 0,
            supplier: input.supplier?.trim() || null,
            notes: input.notes?.trim() || null,
            is_active: input.isActive ?? true
        })
        .eq('id', id)
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

/** Adjust current_qty by a signed delta. Negative deltas can't push the
 *  total below zero — the check constraint enforces this, but we also
 *  clamp client-side for a nicer error message. */
export async function adjustMaterialQty(
    supabase: SupabaseClient,
    id: string,
    delta: number
): Promise<Material> {
    // Read current, then write current+delta. Two-step is fine here —
    // the admin module is single-user.
    const { data: row, error: readErr } = await supabase
        .from('materials')
        .select('current_qty')
        .eq('id', id)
        .single();
    if (readErr) throw readErr;
    const current = num((row as { current_qty: number | string }).current_qty);
    const next = current + delta;
    if (next < 0) {
        throw new Error(
            `No se puede dejar la cantidad en negativo (actual: ${current}, ajuste: ${delta}).`
        );
    }
    const { data, error } = await supabase
        .from('materials')
        .update({ current_qty: next })
        .eq('id', id)
        .select(SELECT)
        .single();
    if (error) throw error;
    return mapRow(data as RawRow);
}

export async function deleteMaterial(
    supabase: SupabaseClient,
    id: string
): Promise<void> {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
}
