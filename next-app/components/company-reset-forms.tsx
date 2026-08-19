'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
    requestPasswordResetAction,
    resetPasswordAction,
    type AuthState
} from '@/app/login/actions';

function Shell({ title, subtitle, children }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white mb-6"
                >
                    <ArrowLeft size={15} /> Volver a iniciar sesión
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="text-sm text-zinc-400 mt-2 mb-8">{subtitle}</p>
                {children}
            </div>
        </div>
    );
}

function Status({ state }: { state?: AuthState }) {
    if (state?.error)
        return (
            <div className="bg-red-900/30 border border-red-700/50 text-red-200 p-3 rounded-lg text-sm mb-4">
                {state.error}
            </div>
        );
    if (state?.message)
        return (
            <div className="bg-emerald-900/30 border border-emerald-700/50 text-emerald-200 p-3 rounded-lg text-sm mb-4">
                {state.message}
            </div>
        );
    return null;
}

const inputCls =
    'w-full bg-zinc-900/70 border border-white/10 hover:border-white/20 focus:border-white/40 focus:bg-zinc-900 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition-colors';
const btnCls =
    'w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 border border-white/10 hover:border-white/20 text-white font-semibold rounded-lg py-3 mt-2 flex items-center justify-center';

export function RequestResetForm() {
    const [state, formAction, pending] = useActionState<AuthState | undefined, FormData>(
        requestPasswordResetAction,
        undefined
    );
    return (
        <Shell
            title="Restablecer contraseña"
            subtitle="Ingresá el correo de tu empresa y te enviamos un enlace para elegir una nueva contraseña."
        >
            <Status state={state} />
            <form action={formAction} className="space-y-4">
                <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Correo electrónico"
                    className={inputCls}
                />
                <button type="submit" disabled={pending} className={btnCls}>
                    {pending ? <Loader2 className="animate-spin" size={18} /> : 'Enviar enlace'}
                </button>
            </form>
        </Shell>
    );
}

export function SetNewPasswordForm({ token }: { token: string }) {
    const [state, formAction, pending] = useActionState<AuthState | undefined, FormData>(
        resetPasswordAction,
        undefined
    );
    const done = state?.message;
    return (
        <Shell
            title="Elegí una nueva contraseña"
            subtitle="Escribila dos veces para confirmar."
        >
            <Status state={state} />
            {done ? (
                <Link href="/login" className={btnCls}>
                    Iniciar sesión
                </Link>
            ) : (
                <form action={formAction} className="space-y-4">
                    <input type="hidden" name="token" value={token} />
                    <input
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Nueva contraseña (mín. 8)"
                        className={inputCls}
                    />
                    <input
                        name="password_confirm"
                        type="password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder="Repetí la contraseña"
                        className={inputCls}
                    />
                    <button type="submit" disabled={pending} className={btnCls}>
                        {pending ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            'Guardar contraseña'
                        )}
                    </button>
                </form>
            )}
        </Shell>
    );
}
