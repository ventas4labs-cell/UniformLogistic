import Link from 'next/link';
import { createServiceClient } from '@/utils/supabase/server';
import { fetchEmployeeByActivationToken } from '@/lib/services/employees';
import { SetPasswordForm } from './set-password-form';

export const dynamic = 'force-dynamic';

// Public page reached from the invite email. Validates the single-use
// token server-side, then renders the set-password form. The token is
// the authorization — no session required.
export default async function ActivarEmpleadoPage({
    params
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    const service = createServiceClient();
    const emp =
        token && token.length >= 16
            ? await fetchEmployeeByActivationToken(service, token)
            : null;

    const expired = !!emp?.expired;

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-10">
            <div className="w-full max-w-sm">
                <div className="text-center mb-6">
                    <div className="inline-block bg-orange-600 text-white font-black text-lg rounded-xl px-3 py-1.5">
                        UL
                    </div>
                    <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-zinc-100">
                        {emp && !expired
                            ? 'Creá tu contraseña'
                            : 'Enlace no disponible'}
                    </h1>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
                    {emp && !expired ? (
                        <>
                            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
                                Hola{' '}
                                <span className="font-bold text-gray-900 dark:text-zinc-100">
                                    {emp.fullName}
                                </span>
                                . Elegí una contraseña para activar tu cuenta y
                                empezar a marcar tu jornada.
                            </p>
                            <SetPasswordForm token={token} />
                        </>
                    ) : (
                        <div className="text-center space-y-4">
                            <p className="text-sm text-gray-600 dark:text-zinc-400">
                                {expired
                                    ? 'Este enlace de invitación venció. Pedile al administrador que te reenvíe la invitación.'
                                    : 'Este enlace no es válido o ya se usó. Si ya creaste tu contraseña, iniciá sesión.'}
                            </p>
                            <Link
                                href="/login"
                                className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm"
                            >
                                Ir a iniciar sesión
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
