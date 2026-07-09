import { createClient } from '@/utils/supabase/server';
import {
    fetchThreeDModels,
    fetchDesignRequests
} from '@/lib/services/three-d-models';
import { fetchCompanies } from '@/lib/services/companies';
import { ThreeDModelsManager } from '@/components/admin/three-d-models-manager';

export default async function ThreeDModelsPage() {
    const supabase = await createClient();
    const [models, companies, requests] = await Promise.all([
        fetchThreeDModels(supabase),
        fetchCompanies(supabase),
        fetchDesignRequests(supabase)
    ]);

    return (
        <ThreeDModelsManager
            initialModels={models}
            companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            initialRequests={requests}
        />
    );
}
