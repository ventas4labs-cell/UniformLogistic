import { AlertCircle, Package } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import {
    fetchCatalogForCompany,
    fetchBasicProducts,
    fetchUserCompanyId
} from '@/lib/services/products';
import { fetchCompanies, isCustomOrderEnabled } from '@/lib/services/companies';
import { fetchModelsForProductIds } from '@/lib/services/three-d-models';
import { fetchLogos } from '@/lib/services/logos';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
import { CatalogGrid } from './catalog-grid';
import { CompanyPicker } from './company-picker';

export default async function CatalogPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null; // layout already redirects

    // ─── Resolve the company we're shopping for ──────────────────────
    let companyId: string;
    let actingCompany: { id: string; name: string } | null = null;

    if (isAdminEmail(user.email)) {
        const companies = (await fetchCompanies(supabase)).filter((c) => c.isActive);
        const actingId = await getActingCompanyId();
        const acting = actingId ? companies.find((c) => c.id === actingId) || null : null;
        if (!acting) return <CompanyPicker companies={companies} />;
        companyId = acting.id;
        actingCompany = { id: acting.id, name: acting.name };
    } else {
        const cid = await fetchUserCompanyId(supabase, user.id);
        if (!cid) {
            return (
                <div className="max-w-md mx-auto mt-10 bg-amber-50 border border-amber-200 text-amber-800 p-8 rounded-2xl text-center">
                    <AlertCircle className="mx-auto mb-4" size={40} />
                    <h3 className="text-xl font-bold mb-2">Cuenta pendiente de activación</h3>
                    <p className="text-sm">
                        Tu cuenta aún no está vinculada a una empresa. Contacta al administrador
                        para que te asigne y puedas comenzar a hacer pedidos.
                    </p>
                </div>
            );
        }
        companyId = cid;
    }

    // ─── Own products + Basic (default) items ────────────────────────
    const [own, basics, enabled, allLogos] = await Promise.all([
        fetchCatalogForCompany(supabase, companyId),
        fetchBasicProducts(supabase),
        isCustomOrderEnabled(supabase, companyId),
        fetchLogos(supabase)
    ]);

    // Basics need a linked 3D model; hide the section if the empresa has
    // the 3D custom-order feature disabled.
    const modelByProduct = enabled
        ? await fetchModelsForProductIds(supabase, basics.map((b) => b.uuid))
        : {};
    const basicItems = basics
        .filter((b) => modelByProduct[b.uuid])
        .map((b) => ({ product: b, model: modelByProduct[b.uuid] }));
    const companyLogos = allLogos.filter(
        (l) => l.isActive && l.companyIds.includes(companyId)
    );

    if (own.length === 0 && basicItems.length === 0) {
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

    return (
        <CatalogGrid
            catalog={own}
            basics={basicItems}
            companyLogos={companyLogos}
            actingCompany={actingCompany}
        />
    );
}
