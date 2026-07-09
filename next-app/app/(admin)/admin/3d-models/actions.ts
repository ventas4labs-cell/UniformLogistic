'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import {
    updateThreeDModel,
    deleteThreeDModel,
    updateDesignRequestStatus,
    type ThreeDModelInput,
    type DesignStatus
} from '@/lib/services/three-d-models';

// Route gate at (admin)/admin/layout.tsx already restricts these to the
// admin email, same as the other admin modules (catalogo-default etc.).
const REVAL_PATHS = ['/admin/3d-models', '/custom-order', '/catalog'];

export async function updateModelAction(id: string, input: ThreeDModelInput) {
    const supabase = await createClient();
    await updateThreeDModel(supabase, id, input);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

export async function deleteModelAction(id: string) {
    const supabase = await createClient();
    await deleteThreeDModel(supabase, id);
    for (const p of REVAL_PATHS) revalidatePath(p);
}

export async function updateDesignStatusAction(id: string, status: DesignStatus) {
    const supabase = await createClient();
    await updateDesignRequestStatus(supabase, id, status);
    revalidatePath('/admin/3d-models');
}
