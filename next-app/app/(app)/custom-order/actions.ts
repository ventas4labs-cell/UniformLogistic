'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import { fetchUserCompanyId } from '@/lib/services/products';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
import { fetchLogos } from '@/lib/services/logos';
import { isCustomOrderEnabled } from '@/lib/services/companies';
import {
    fetchModelsForCompany,
    createDesignRequest
} from '@/lib/services/three-d-models';

interface SubmitInput {
    modelId: string;
    modelName: string;
    colorName: string;
    notes: string;
    previewDataUrl: string;
    logos: { zoneId: string; zoneLabel: string; logoId: string }[];
}

// Upload the captured canvas snapshot (data URL) to models-3d/previews/.
async function uploadPreview(
    supabase: Awaited<ReturnType<typeof createClient>>,
    dataUrl: string
): Promise<string> {
    const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return '';
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) return '';
    const key = `previews/${randomUUID()}.png`;
    const { error } = await supabase.storage
        .from('models-3d')
        .upload(key, bytes, { contentType: m[1], upsert: false });
    if (error) return '';
    return supabase.storage.from('models-3d').getPublicUrl(key).data.publicUrl;
}

export async function submitCustomDesignAction(
    input: SubmitInput
): Promise<{ ok: boolean; requestRef?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado.' };

    // Re-derive the company server-side — never trust the client.
    const companyId = isAdminEmail(user.email)
        ? await getActingCompanyId()
        : await fetchUserCompanyId(supabase, user.id);
    if (!companyId) return { ok: false, error: 'No se pudo determinar tu empresa.' };

    // Master switch — reject if the feature is disabled for this empresa.
    if (!(await isCustomOrderEnabled(supabase, companyId))) {
        return { ok: false, error: 'El pedido 3D personalizado no está habilitado para tu empresa.' };
    }

    // The model must actually be assigned to this company.
    const models = await fetchModelsForCompany(supabase, companyId);
    const model = models.find((m) => m.id === input.modelId);
    if (!model) return { ok: false, error: 'Modelo no disponible para tu empresa.' };

    // Only accept logos that belong to this company; snapshot name + url.
    const companyLogos = (await fetchLogos(supabase)).filter(
        (l) => l.isActive && l.companyIds.includes(companyId)
    );
    const logoById = new Map(companyLogos.map((l) => [l.id, l]));
    const validZoneIds = new Set(model.zones.map((z) => z.id));

    const logos = model.allowLogoPlacement
        ? input.logos
              .filter((l) => validZoneIds.has(l.zoneId) && logoById.has(l.logoId))
              .map((l) => {
                  const logo = logoById.get(l.logoId)!;
                  return {
                      zoneId: l.zoneId,
                      zoneLabel: l.zoneLabel,
                      logoId: l.logoId,
                      logoImageUrl: logo.imageUrl,
                      logoName: logo.name
                  };
              })
        : [];

    try {
        const previewUrl = input.previewDataUrl
            ? await uploadPreview(supabase, input.previewDataUrl)
            : '';

        const { requestRef } = await createDesignRequest(
            supabase,
            {
                companyId,
                modelId: model.id,
                modelName: input.modelName || model.name,
                colorName: input.colorName,
                notes: input.notes,
                previewUrl
            },
            logos,
            user.id
        );

        revalidatePath('/admin/3d-models');
        return { ok: true, requestRef };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'No se pudo enviar el diseño.' };
    }
}
