'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, LogOut } from 'lucide-react';
import { signInAction, signOutAction, signUpAction, type AuthState } from './actions';

export function LoginForm({ currentEmail }: { currentEmail?: string | null }) {
    const [isSignUp, setIsSignUp] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const action = isSignUp ? signUpAction : signInAction;
    const [state, formAction, pending] = useActionState<AuthState | undefined, FormData>(
        action,
        undefined
    );

    return (
        <div className="relative min-h-screen w-full bg-black text-white overflow-hidden flex flex-col">
            {/* ── Ambient background (pure CSS, no asset) ─────────────── */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
                {/* Orange — top right (warm) */}
                <div
                    className="bg-blob absolute -top-40 -right-32 w-[60vw] h-[100vh] rounded-full blur-3xl"
                    style={{
                        background:
                            'radial-gradient(ellipse at center, rgba(251,146,60,0.55) 0%, rgba(234,88,12,0.25) 35%, transparent 70%)',
                        animation: 'drift-a 26s ease-in-out infinite'
                    }}
                />
                {/* White silk — bottom left */}
                <div
                    className="bg-blob absolute -bottom-40 -left-40 w-[60vw] h-[110vh] rounded-full blur-3xl"
                    style={{
                        background:
                            'radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 40%, transparent 75%)',
                        animation: 'drift-b 32s ease-in-out infinite'
                    }}
                />
                {/* Deep orange — center halo behind card */}
                <div
                    className="bg-blob absolute top-1/3 left-1/2 -translate-x-1/2 w-[55vw] h-[55vw] rounded-full blur-3xl"
                    style={{
                        background:
                            'radial-gradient(circle, rgba(249,115,22,0.30) 0%, rgba(249,115,22,0.08) 45%, transparent 75%)',
                        animation: 'drift-c 28s ease-in-out infinite'
                    }}
                />
                {/* Cool white — top left accent */}
                <div
                    className="bg-blob absolute -top-32 -left-24 w-[42vw] h-[60vh] rounded-full blur-3xl"
                    style={{
                        background:
                            'radial-gradient(ellipse at center, rgba(255,255,255,0.32) 0%, transparent 70%)',
                        animation: 'drift-d 36s ease-in-out infinite'
                    }}
                />
                {/* Warm orange — bottom right accent */}
                <div
                    className="bg-blob absolute -bottom-28 -right-24 w-[45vw] h-[65vh] rounded-full blur-3xl"
                    style={{
                        background:
                            'radial-gradient(ellipse at center, rgba(251,146,60,0.30) 0%, transparent 70%)',
                        animation: 'drift-d 30s ease-in-out infinite reverse',
                        animationDelay: '-8s'
                    }}
                />
                {/* Film-grain overlay (static, masks bands from gradients) */}
                <div
                    className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
                    style={{
                        backgroundImage:
                            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%22 height=%22100%22 filter=%22url(%23n)%22 opacity=%22.6%22/></svg>")'
                    }}
                />
                {/* Dark vignette on top so card text stays legible */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
            </div>

            {/* ── Top bar ─────────────────────────────────────────────── */}
            <header className="relative z-10 px-6 sm:px-10 py-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                >
                    <ArrowLeft size={16} />
                    Inicio
                </Link>
            </header>

            {/* ── Centered card ───────────────────────────────────────── */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-16">
                <div className="w-full max-w-sm">
                    {/* Logo */}
                    <div className="flex justify-center mb-7">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900/80 border border-white/10 flex items-center justify-center text-white font-black text-base tracking-tight shadow-2xl">
                            UL
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-center text-3xl font-bold tracking-tight">
                        {isSignUp ? 'Crea tu cuenta' : 'Inicia sesión en Uniform Logistic'}
                    </h1>
                    <p className="text-center text-zinc-400 text-sm mt-3 mb-10">
                        {isSignUp ? (
                            <>
                                ¿Ya tienes cuenta?{' '}
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(false)}
                                    className="text-white font-semibold hover:underline"
                                >
                                    Inicia sesión
                                </button>
                                .
                            </>
                        ) : (
                            <>
                                ¿No tienes cuenta?{' '}
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(true)}
                                    className="text-white font-semibold hover:underline"
                                >
                                    Regístrate
                                </button>
                                .
                            </>
                        )}
                    </p>

                    {/* Active session — lets a station user (or admin who
                        opened a station link) sign out and get back into
                        the system instead of being trapped on /station. */}
                    {currentEmail && (
                        <div className="mb-6 rounded-lg border border-white/10 bg-zinc-900/70 p-4">
                            <p className="text-sm text-zinc-300">
                                Ya tienes una sesión activa como{' '}
                                <span className="font-semibold text-white">{currentEmail}</span>.
                            </p>
                            <form action={signOutAction} className="mt-3">
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-sm font-semibold text-white transition-colors"
                                >
                                    <LogOut size={15} />
                                    Cerrar sesión para cambiar de cuenta
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Status */}
                    {state?.error && (
                        <div className="bg-red-900/30 border border-red-700/50 text-red-200 p-3 rounded-lg text-sm mb-4">
                            {state.error}
                        </div>
                    )}
                    {state?.message && (
                        <div className="bg-emerald-900/30 border border-emerald-700/50 text-emerald-200 p-3 rounded-lg text-sm mb-4">
                            {state.message}
                        </div>
                    )}

                    {/* Form */}
                    <form action={formAction} className="space-y-5">
                        {isSignUp && (
                            <>
                                <DarkField label="Empresa" name="company_name" required />
                                <DarkField label="Nombre completo" name="full_name" required />
                                <DarkField
                                    label="Teléfono"
                                    name="phone"
                                    type="tel"
                                    required
                                />
                            </>
                        )}

                        <DarkField
                            label="Correo electrónico"
                            name="email"
                            type="email"
                            required
                            autoComplete="email"
                        />

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label
                                    htmlFor="password"
                                    className="text-sm font-medium text-zinc-300"
                                >
                                    Contraseña
                                </label>
                                {!isSignUp && (
                                    <a
                                        href="#"
                                        className="text-sm font-semibold text-white hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </a>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                    className="w-full bg-zinc-900/70 border border-white/10 hover:border-white/20 focus:border-white/40 focus:bg-zinc-900 rounded-lg pl-4 pr-11 py-3 text-white placeholder:text-zinc-500 outline-none transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white"
                                    aria-label={
                                        showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                                    }
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={pending}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-700 disabled:opacity-60 disabled:cursor-not-allowed border border-white/10 hover:border-white/20 text-white font-semibold rounded-lg py-3 mt-2 flex items-center justify-center transition-colors"
                        >
                            {pending ? (
                                <Loader2 className="animate-spin" size={18} />
                            ) : isSignUp ? (
                                'Crear mi cuenta'
                            ) : (
                                'Iniciar sesión'
                            )}
                        </button>
                    </form>

                    <p className="text-center text-xs text-zinc-500 mt-8">
                        Al iniciar sesión aceptas nuestros{' '}
                        <a href="#" className="text-zinc-300 underline hover:text-white">
                            Términos
                        </a>{' '}
                        y{' '}
                        <a href="#" className="text-zinc-300 underline hover:text-white">
                            Política de Privacidad
                        </a>
                        .
                    </p>
                </div>
            </main>
        </div>
    );
}

// ── Subcomponents ───────────────────────────────────────────────────────

function DarkField({
    label,
    name,
    type = 'text',
    required,
    autoComplete
}: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
    autoComplete?: string;
}) {
    return (
        <div>
            <label htmlFor={name} className="block text-sm font-medium text-zinc-300 mb-2">
                {label}
            </label>
            <input
                id={name}
                name={name}
                type={type}
                required={required}
                autoComplete={autoComplete}
                className="w-full bg-zinc-900/70 border border-white/10 hover:border-white/20 focus:border-white/40 focus:bg-zinc-900 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition-colors"
            />
        </div>
    );
}
