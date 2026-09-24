import Link from 'next/link';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchEmployees } from '@/lib/services/employees';
import { fetchAllTimeOff } from '@/lib/services/hr-time-off';
import { TimeOffReview } from './time-off-review';

export const dynamic = 'force-dynamic';

// Time-off requests filed from the employee portal. Pending first; an
// approved request suppresses "Ausente" on the attendance dashboard.
export default async function PermisosAdminPage() {
    const supabase = await createClient();
    const [requests, employees] = await Promise.all([
        fetchAllTimeOff(supabase),
        fetchEmployees(supabase)
    ]);

    const names: Record<string, string> = {};
    for (const e of employees) names[e.id] = e.fullName;

    return (
        <div>
            <div className="mb-6">
                <Link
                    href="/admin/rrhh"
                    className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 mb-1"
                >
                    <ArrowLeft size={14} /> Recursos Humanos
                </Link>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
                    <CalendarDays size={24} className="text-orange-600 dark:text-orange-400" />
                    Permisos
                </h2>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                    Solicitudes de vacaciones, incapacidades y permisos de los empleados.
                </p>
            </div>
            <TimeOffReview requests={requests} names={names} />
        </div>
    );
}
