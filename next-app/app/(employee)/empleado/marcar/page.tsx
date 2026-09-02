import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/utils/supabase/server';
import { fetchEmployee } from '@/lib/services/employees';
import { fetchPunchToken } from '@/lib/services/hr-kiosks';
import {
    deriveState,
    fetchTodayPunches,
    lastPunchType,
    nextActions
} from '@/lib/services/hr-punches';
import { MarcarPanel, type TokenStatus } from './marcar-panel';

export const dynamic = 'force-dynamic';

// Reached by scanning the kiosk QR: /empleado/marcar?t=<token>. The
// (employee) layout already guarantees an active employee session.
export default async function MarcarPage({
    searchParams
}: {
    searchParams: Promise<{ t?: string }>;
}) {
    const { t } = await searchParams;
    const token = t || '';

    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const [employee, punches] = await Promise.all([
        fetchEmployee(supabase, user.id),
        fetchTodayPunches(supabase, user.id)
    ]);

    const service = createServiceClient();
    const pt = token ? await fetchPunchToken(service, token) : null;
    const tokenStatus: TokenStatus = !token
        ? 'missing'
        : !pt
          ? 'invalid'
          : pt.expired
            ? 'expired'
            : 'ok';

    const state = deriveState(lastPunchType(punches));

    return (
        <MarcarPanel
            token={token}
            tokenStatus={tokenStatus}
            initialState={state}
            initialActions={nextActions(state)}
            initialPunches={punches}
            employeeName={employee?.fullName || ''}
        />
    );
}
