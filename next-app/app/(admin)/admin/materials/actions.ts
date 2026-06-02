'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    adjustMaterialQty,
    createMaterial,
    deleteMaterial,
    updateMaterial,
    type MaterialInput
} from '@/lib/services/materials';
import { isAdminEmail } from '@/lib/admin-acting-company';

async function requireAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' as const, supabase: null };
    if (!isAdminEmail(user.email)) return { error: 'No autorizado.' as const, supabase: null };
    return { error: null, supabase };
}

export async function createMaterialAction(
    input: MaterialInput
): Promise<{ error?: string }> {
    const { error, supabase } = await requireAdmin();
    if (error) return { error };
    try {
        await createMaterial(supabase!, input);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al crear material.';
        return { error: msg };
    }
    revalidatePath('/admin/materials');
    return {};
}

export async function updateMaterialAction(
    id: string,
    input: MaterialInput
): Promise<{ error?: string }> {
    const { error, supabase } = await requireAdmin();
    if (error) return { error };
    try {
        await updateMaterial(supabase!, id, input);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al actualizar.';
        return { error: msg };
    }
    revalidatePath('/admin/materials');
    return {};
}

export async function adjustMaterialQtyAction(
    id: string,
    delta: number
): Promise<{ error?: string }> {
    const { error, supabase } = await requireAdmin();
    if (error) return { error };
    try {
        await adjustMaterialQty(supabase!, id, delta);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al ajustar.';
        return { error: msg };
    }
    revalidatePath('/admin/materials');
    return {};
}

export async function deleteMaterialAction(
    id: string
): Promise<{ error?: string }> {
    const { error, supabase } = await requireAdmin();
    if (error) return { error };
    try {
        await deleteMaterial(supabase!, id);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al eliminar.';
        return { error: msg };
    }
    revalidatePath('/admin/materials');
    return {};
}
