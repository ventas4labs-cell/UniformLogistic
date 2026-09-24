import { createClient } from '@/utils/supabase/server';
import { fetchEmployees } from '@/lib/services/employees';
import { fetchKiosks } from '@/lib/services/hr-kiosks';
import { fetchSchedulesMap } from '@/lib/services/hr-schedules';
import { countPendingTimeOff } from '@/lib/services/hr-time-off';
import { RrhhManager } from '@/components/admin/rrhh-manager';

// Recursos Humanos — employees + email invite (P1), kiosks / rotating-QR
// punch (P2), and per-employee schedules feeding the attendance
// dashboard at /admin/rrhh/asistencia (P3), and time-off requests from
// the employee portal at /admin/rrhh/permisos.
export default async function RrhhPage() {
    const supabase = await createClient();
    const [employees, kiosks, schedules, pendingTimeOff] = await Promise.all([
        fetchEmployees(supabase),
        fetchKiosks(supabase),
        fetchSchedulesMap(supabase),
        countPendingTimeOff(supabase)
    ]);
    return (
        <RrhhManager
            initialEmployees={employees}
            initialKiosks={kiosks}
            initialSchedules={schedules}
            pendingTimeOff={pendingTimeOff}
        />
    );
}
