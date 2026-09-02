import { createClient } from '@/utils/supabase/server';
import { fetchEmployees } from '@/lib/services/employees';
import { fetchKiosks } from '@/lib/services/hr-kiosks';
import { fetchSchedulesMap } from '@/lib/services/hr-schedules';
import { RrhhManager } from '@/components/admin/rrhh-manager';

// Recursos Humanos — employees + email invite (P1), kiosks / rotating-QR
// punch (P2), and per-employee schedules feeding the attendance
// dashboard at /admin/rrhh/asistencia (P3).
export default async function RrhhPage() {
    const supabase = await createClient();
    const [employees, kiosks, schedules] = await Promise.all([
        fetchEmployees(supabase),
        fetchKiosks(supabase),
        fetchSchedulesMap(supabase)
    ]);
    return (
        <RrhhManager
            initialEmployees={employees}
            initialKiosks={kiosks}
            initialSchedules={schedules}
        />
    );
}
