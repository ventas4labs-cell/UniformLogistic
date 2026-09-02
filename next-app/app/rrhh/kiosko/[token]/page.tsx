import { createServiceClient } from '@/utils/supabase/server';
import { fetchKioskByAccessToken } from '@/lib/services/hr-kiosks';
import { KioskDisplay } from './kiosk-display';

export const dynamic = 'force-dynamic';

// Public kiosk screen for a shared workplace device. Protected by the
// secret access token in the URL. Shows a QR that rotates every 10 min;
// employees scan it with their own logged-in phone to punch.
export default async function KioskPage({
    params
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const service = createServiceClient();
    const kiosk =
        token && token.length >= 16
            ? await fetchKioskByAccessToken(service, token)
            : null;

    if (!kiosk) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-300 px-6 text-center">
                <div>
                    <p className="text-2xl font-bold">Kiosco no disponible</p>
                    <p className="mt-2 text-zinc-500">
                        El enlace no es válido o el kiosco está inactivo.
                    </p>
                </div>
            </div>
        );
    }

    return <KioskDisplay kioskToken={token} label={kiosk.label} />;
}
