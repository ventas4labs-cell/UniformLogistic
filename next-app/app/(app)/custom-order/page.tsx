import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchUserCompanyId } from '@/lib/services/products';
import { fetchModelsForCompany } from '@/lib/services/three-d-models';
import { fetchLogos } from '@/lib/services/logos';
import { getActingCompanyId, isAdminEmail } from '@/lib/admin-acting-company';
import { CustomOrderStudio } from '@/components/custom-order/custom-order-studio';

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center mb-4">
                <Sparkles size={30} />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                Pedido 3D personalizado
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">{message}</p>
            <Link
                href="/catalog"
                className="mt-6 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
            >
                Ir al catálogo
            </Link>
        </div>
    );
}

export default async function CustomOrderPage() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    const companyId = isAdminEmail(user.email)
        ? await getActingCompanyId()
        : await fetchUserCompanyId(supabase, user.id);

    if (!companyId) {
        return (
            <EmptyState message="Tu cuenta aún no está vinculada a una empresa. Contactá a Uniform Logistic para activarla." />
        );
    }

    const [models, allLogos] = await Promise.all([
        fetchModelsForCompany(supabase, companyId),
        fetchLogos(supabase)
    ]);
    const logos = allLogos.filter((l) => l.isActive && l.companyIds.includes(companyId));

    if (models.length === 0) {
        return (
            <EmptyState message="Tu empresa aún no tiene modelos 3D disponibles. Escribinos si querés habilitar el pedido personalizado." />
        );
    }

    return <CustomOrderStudio models={models} logos={logos} />;
}
