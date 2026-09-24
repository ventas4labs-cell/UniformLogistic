import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { addDaysStr, crToday } from '@/lib/services/hr-punches';
import {
    fetchEmployeeTimeOff,
    TIME_OFF_MAX_BACKDATE_DAYS
} from '@/lib/services/hr-time-off';
import { PermisosPanel } from './permisos-panel';

export const dynamic = 'force-dynamic';

export default async function PermisosPage() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const requests = await fetchEmployeeTimeOff(supabase, user.id);
    const today = crToday();

    return (
        <PermisosPanel
            requests={requests}
            today={today}
            minDate={addDaysStr(today, -TIME_OFF_MAX_BACKDATE_DAYS)}
        />
    );
}
