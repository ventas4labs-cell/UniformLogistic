'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/utils/supabase/server';
import { fetchUserCompanyId } from '@/lib/services/products';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
import { fetchLogos } from '@/lib/services/logos';
import { isCustomOrderEnabled } from '@/lib/services/companies';
import {
    fetchModelById,
    createDesignRequest,
    type DesignLogoInput,
    type DesignItem
} from '@/lib/services/three-d-models';

interface SubmitLogo {
    zoneId: string;
    zoneLabel: string;
    /** Set for a company logo; null for a customer-uploaded custom logo. */
    logoId: string | null;
    /** Set for a custom logo — must be a models-3d bucket URL. */
    customUrl?: string;
    customName?: string;
}

interface SubmitInput {
    modelId: string;
    modelName: string;
    colorName: string;
    notes: string;
    previewDataUrl: string;
    logos: SubmitLogo[];
    items: DesignItem[];
}

const ALLOWED_LOGO_MIME = ['image/jpeg', 'image/jpg', 'image/png'];

// Customer uploads their own artwork for a zone (jpg/png only). Goes to
// the models-3d bucket under custom-logos/. Returns the public URL.
export async function uploadCustomLogoAction(
    formData: FormData
): Promise<{ url?: string; error?: string }> {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' };

    const file = formData.get('file');
    if (!(file instanceof File)) return { error: 'No se recibió el archivo.' };
    if (!ALLOWED_LOGO_MIME.includes(file.type)) {
        return { error: 'Solo se permiten imágenes JPG o PNG.' };
    }
    if (file.size > 6 * 1024 * 1024) {
        return { error: 'La imagen no puede superar 6 MB.' };
    }
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const key = `custom-logos/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage
        .from('models-3d')
        .upload(key, file, { contentType: file.type, upsert: false });
    if (error) return { error: 'No se pudo subir la imagen.' };
    return { url: supabase.storage.from('models-3d').getPublicUrl(key).data.publicUrl };
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

    // Resolve the model (basic-item models reach here via the product,
    // not a company assignment). Must exist + be active.
    const model = await fetchModelById(supabase, input.modelId);
    if (!model || !model.isActive) {
        return { ok: false, error: 'Modelo no disponible.' };
    }

    // Only accept logos that belong to this company; snapshot name + url.
    const companyLogos = (await fetchLogos(supabase)).filter(
        (l) => l.isActive && l.companyIds.includes(companyId)
    );
    const logoById = new Map(companyLogos.map((l) => [l.id, l]));
    const validZoneIds = new Set(model.zones.map((z) => z.id));
    const modelsBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/models-3d/`;

    const logos: DesignLogoInput[] = model.allowLogoPlacement
        ? input.logos.flatMap((l): DesignLogoInput[] => {
              if (!validZoneIds.has(l.zoneId)) return [];
              // Company logo.
              if (l.logoId && logoById.has(l.logoId)) {
                  const logo = logoById.get(l.logoId)!;
                  return [{
                      zoneId: l.zoneId,
                      zoneLabel: l.zoneLabel,
                      logoId: l.logoId,
                      logoImageUrl: logo.imageUrl,
                      logoName: logo.name
                  }];
              }
              // Custom (customer-uploaded) logo — only if the model allows it
              // and the URL is one we minted in the models-3d bucket.
              if (
                  model.allowCustomLogo &&
                  !l.logoId &&
                  l.customUrl &&
                  l.customUrl.startsWith(modelsBase)
              ) {
                  return [{
                      zoneId: l.zoneId,
                      zoneLabel: l.zoneLabel,
                      logoId: null,
                      logoImageUrl: l.customUrl,
                      logoName: l.customName?.trim() || 'Logo personalizado'
                  }];
              }
              return [];
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
                productId: model.productId,
                productCode: model.productCode,
                productName: model.productName,
                colorName: input.colorName,
                notes: input.notes,
                previewUrl,
                items: input.items
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
