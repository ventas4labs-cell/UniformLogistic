import { createClient } from '@/utils/supabase/server';
import { fetchEmployees } from '@/lib/services/employees';
import { fetchKiosks } from '@/lib/services/hr-kiosks';
import { RrhhManager } from '@/components/admin/rrhh-manager';

// Recursos Humanos — Phase 1: employee profiles + email invite.
// Phase 2 adds kiosks (rotating-QR punch screens). The schedule +
// dashboard (P3) land later.
export default async function RrhhPage() {
    const supabase = await createClient();
    const [employees, kiosks] = await Promise.all([
        fetchEmployees(supabase),
        fetchKiosks(supabase)
    ]);
    return <RrhhManager initialEmployees={employees} initialKiosks={kiosks} />;
}
