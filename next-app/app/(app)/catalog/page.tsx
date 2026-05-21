import { AlertCircle, Package } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import {
    fetchCatalogForCompany,
    fetchCatalogForUser,
    fetchUserCompanyId
} from '@/lib/services/products';
import { fetchCompanies } from '@/lib/services/companies';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
import { CatalogGrid } from './catalog-grid';
import { CompanyPicker } from './company-picker';

export default async function CatalogPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null; // layout already redirects

    // ─── Admin branch ────────────────────────────────────────────────
    // Admin doesn't have a company_users link; they choose which company
    // to place the order for via a cookie set by the company picker.
    if (isAdminEmail(user.email)) {
        const companies = (await fetchCompanies(supabase)).filter((c) => c.isActive);
        const actingId = await getActingCompanyId();
        const acting = actingId
            ? companies.find((c) => c.id === actingId) || null
            : null;

        if (!acting) {
            return <CompanyPicker companies={companies} />;
        }

        const catalog = await fetchCatalogForCompany(supabase, acting.id);

        if (catalog.length === 0) {
            return (
                <CatalogGrid
                    catalog={catalog}
                    actingCompany={{ id: acting.id, name: acting.name }}
                />
            );
        }

        return (
            <CatalogGrid
                catalog={catalog}
                actingCompany={{ id: acting.id, name: acting.name }}
            />
        );
    }

    // ─── Customer branch (unchanged) ─────────────────────────────────
    const catalog = await fetchCatalogForUser(supabase, user.id);

    if (catalog.length === 0) {
        const companyId = await fetchUserCompanyId(supabase, user.id);
        if (!companyId) {
            return (
                <div className="max-w-md mx-auto mt-10 bg-amber-50 border border-amber-200 text-amber-800 p-8 rounded-2xl text-center">
                    <AlertCircle className="mx-auto mb-4" size={40} />
                    <h3 className="text-xl font-bold mb-2">Cuenta pendiente de activación</h3>
                    <p className="text-sm">
                        Tu cuenta aún no está vinculada a una empresa. Contacta al administrador para que te asigne y puedas comenzar a hacer pedidos.
                    </p>
                </div>
            );
        }
        return (
            <div className="max-w-md mx-auto mt-10 bg-zinc-50 border border-zinc-200 text-zinc-600 p-8 rounded-2xl text-center">
                <Package className="mx-auto mb-4 opacity-40" size={40} />
                <h3 className="text-xl font-bold mb-2">Catálogo vacío</h3>
                <p className="text-sm">
                    Tu empresa aún no tiene productos asignados. Contacta al administrador.
                </p>
            </div>
        );
    }

    return <CatalogGrid catalog={catalog} />;
}
