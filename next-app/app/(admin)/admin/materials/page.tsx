import { createClient } from '@/utils/supabase/server';
import { fetchMaterials } from '@/lib/services/materials';
import { MaterialsManager } from '@/components/admin/materials-manager';

export default async function MaterialsPage() {
    const supabase = await createClient();
    const materials = await fetchMaterials(supabase);
    return <MaterialsManager initialMaterials={materials} />;
}
