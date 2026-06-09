'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    createCompany,
    updateCompany,
    deleteCompany,
    fetchCompanyById,
    setCompanyOrderLink,
    setCompanyAccessToken,
    CompanyInput
} from '@/lib/services/companies';
import { assignUserToCompany } from '@/lib/services/companyUsers';
import { isAdminEmail } from '@/lib/admin-acting-company';

// 32-byte URL-safe random token. Doubles as the /o/<token> slug the
// company bookmarks and the order auth user's password — the station
// model applied to empresas.
function generateAccessToken(): string {
    return randomBytes(32)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Synthetic, never-emailed address for the company's order user. The
// company never sees or types it — they only use the link.
function syntheticOrderEmail(): string {
    return `pedidos-${randomBytes(9).toString('hex')}@no-reply.uniformlogistic.app`;
}

async function requireAdmin() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { error: 'No autenticado.' as const };
    if (!isAdminEmail(user.email)) return { error: 'No autorizado.' as const };
    return { error: null };
}

// Create the order auth user (password = token), link it to the
// company, and persist the link fields. Returns the token + email.
async function provisionOrderLink(
    service: SupabaseClient,
    companyId: string,
    fullName: string
): Promise<{ accessToken: string; orderUserEmail: string; orderUserId: string }> {
    const accessToken = generateAccessToken();
    const orderUserEmail = syntheticOrderEmail();

    const { data: created, error: authErr } = await service.auth.admin.createUser({
        email: orderUserEmail,
        password: accessToken,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'client' }
    });
    if (authErr || !created.user) {
        throw new Error(authErr?.message || 'No se pudo crear el usuario de pedidos.');
    }

    try {
        await assignUserToCompany(service, created.user.id, companyId, 'client');
        await setCompanyOrderLink(service, companyId, {
            accessToken,
            orderUserId: created.user.id,
            orderUserEmail
        });
    } catch (err) {
        // Roll back the auth user so a retry doesn't leak orphans.
        await service.auth.admin.deleteUser(created.user.id);
        throw err;
    }

    return { accessToken, orderUserEmail, orderUserId: created.user.id };
}

/**
 * Create an empresa and auto-provision its individual order link. The
 * admin no longer creates a username/password — the company places
 * orders through the /o/<token> link alone.
 */
export async function createCompanyAction(
    input: CompanyInput
): Promise<{ error?: string; companyId?: string; accessToken?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    const supabase = await createClient();
    let company;
    try {
        company = await createCompany(supabase, input);
    } catch (err) {
        return {
            error: `No se pudo crear la empresa: ${err instanceof Error ? err.message : 'error desconocido'}`
        };
    }

    const service = createServiceClient();
    try {
        const { accessToken } = await provisionOrderLink(
            service,
            company.id,
            (input.contactName || input.name).trim()
        );
        revalidatePath('/admin/companies');
        return { companyId: company.id, accessToken };
    } catch (err) {
        // Company exists but the link failed — admin can retry with the
        // per-row "Generar link" button. Don't delete the company.
        revalidatePath('/admin/companies');
        return {
            error: `Empresa creada, pero no se pudo generar el link: ${err instanceof Error ? err.message : 'error desconocido'}`,
            companyId: company.id
        };
    }
}

/** Provision a link for an existing company that doesn't have one yet. */
export async function generateCompanyOrderLinkAction(
    companyId: string
): Promise<{ error?: string; accessToken?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    const supabase = await createClient();
    const company = await fetchCompanyById(supabase, companyId);
    if (!company) return { error: 'Empresa no encontrada.' };
    if (company.accessToken) return { accessToken: company.accessToken };

    const service = createServiceClient();
    try {
        const { accessToken } = await provisionOrderLink(
            service,
            companyId,
            company.contactName || company.name
        );
        revalidatePath('/admin/companies');
        return { accessToken };
    } catch (err) {
        return {
            error: `No se pudo generar el link: ${err instanceof Error ? err.message : 'error desconocido'}`
        };
    }
}

/**
 * Rotate the company's order link. Old links stop working immediately.
 * Reuses the existing order user (just changes its password + token);
 * if the company never had a link, provisions one fresh.
 */
export async function regenerateCompanyOrderLinkAction(
    companyId: string
): Promise<{ error?: string; accessToken?: string }> {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) return { error: adminErr };

    const supabase = await createClient();
    const company = await fetchCompanyById(supabase, companyId);
    if (!company) return { error: 'Empresa no encontrada.' };

    const service = createServiceClient();

    if (!company.orderUserId) {
        // No order user yet → provision from scratch.
        try {
            const { accessToken } = await provisionOrderLink(
                service,
                companyId,
                company.contactName || company.name
            );
            revalidatePath('/admin/companies');
            return { accessToken };
        } catch (err) {
            return {
                error: `No se pudo generar el link: ${err instanceof Error ? err.message : 'error desconocido'}`
            };
        }
    }

    const newToken = generateAccessToken();
    const { error: authErr } = await service.auth.admin.updateUserById(
        company.orderUserId,
        { password: newToken }
    );
    if (authErr) {
        return { error: `No se pudo rotar el acceso: ${authErr.message}` };
    }
    try {
        await setCompanyAccessToken(service, companyId, newToken);
    } catch (err) {
        return {
            error: err instanceof Error ? err.message : 'No se pudo guardar el token.'
        };
    }
    revalidatePath('/admin/companies');
    return { accessToken: newToken };
}

export async function updateCompanyAction(id: string, input: CompanyInput) {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) throw new Error(adminErr);
    const supabase = await createClient();
    await updateCompany(supabase, id, input);
    revalidatePath('/admin/companies');
}

export async function deleteCompanyAction(id: string) {
    const { error: adminErr } = await requireAdmin();
    if (adminErr) throw new Error(adminErr);
    const supabase = await createClient();
    await deleteCompany(supabase, id);
    revalidatePath('/admin/companies');
}
