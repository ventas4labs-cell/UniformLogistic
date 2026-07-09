import { createClient } from '@/utils/supabase/server';
import {
    fetchThreeDModels,
    fetchDesignRequests
} from '@/lib/services/three-d-models';
import { fetchCompanies } from '@/lib/services/companies';
import { fetchProducts } from '@/lib/services/products';
import { ThreeDModelsManager } from '@/components/admin/three-d-models-manager';

export default async function ThreeDModelsPage() {
    const supabase = await createClient();
    const [models, companies, requests, products] = await Promise.all([
        fetchThreeDModels(supabase),
        fetchCompanies(supabase),
        fetchDesignRequests(supabase),
        fetchProducts(supabase)
    ]);

    return (
        <ThreeDModelsManager
            initialModels={models}
            companies={companies.map((c) => ({
                id: c.id,
                name: c.name,
                customOrderEnabled: c.customOrderEnabled
            }))}
            products={products.map((p) => ({ id: p.uuid, name: p.name, code: p.id }))}
            initialRequests={requests}
        />
    );
}
