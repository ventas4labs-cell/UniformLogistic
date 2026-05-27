import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { fetchStationUser } from '@/lib/services/station-users';

// ─── Restricted shell for external station users ────────────────────
// Anyone reaching /station who isn't an active station_users row is
// bounced. Admin and customers have their own shells and never see
// this one — fetchStationUser returns null for them, so the redirect
// fires.

export default async function StationLayout({
    children
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const station = await fetchStationUser(supabase, user.id);
    if (!station) redirect('/home');
    if (!station.isActive) redirect('/login');

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors">
            {children}
        </div>
    );
}
