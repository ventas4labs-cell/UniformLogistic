'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Building, Loader2, Lock, Mail, Phone, User } from 'lucide-react';
import { signInAction, signUpAction, type AuthState } from './actions';

export function LoginForm() {
    const [isSignUp, setIsSignUp] = useState(false);
    const action = isSignUp ? signUpAction : signInAction;
    const [state, formAction, pending] = useActionState<AuthState | undefined, FormData>(
        action,
        undefined
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-orange-900/20 rounded-full blur-[80px]" />

            <div className="bg-white p-8 lg:p-12 rounded-3xl shadow-2xl w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="bg-orange-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-orange-600 shadow-sm ring-1 ring-orange-100">
                        <Lock size={36} />
                    </div>
                    <h1 className="text-3xl font-bold text-zinc-900 mb-3 tracking-tight">
                        {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
                    </h1>
                    <p className="text-zinc-500 font-medium">
                        {isSignUp
                            ? 'Únete a Uniform Logistic hoy'
                            : 'Accede a tu panel de pedidos'}
                    </p>
                </div>

                {state?.error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm mb-8 flex items-center gap-3 border border-red-100">
                        <span className="text-lg">⚠️</span>
                        <span className="font-semibold">{state.error}</span>
                    </div>
                )}
                {state?.message && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-8 flex items-center gap-3 border border-green-100">
                        <span className="text-lg">✅</span>
                        <span className="font-semibold">{state.message}</span>
                    </div>
                )}

                <form action={formAction} className="space-y-4">
                    {isSignUp && (
                        <>
                            <InputField name="company_name" placeholder="Nombre de la Empresa" Icon={Building} required />
                            <InputField name="full_name" placeholder="Nombre Completo" Icon={User} required />
                            <InputField name="phone" type="tel" placeholder="Teléfono" Icon={Phone} required />
                        </>
                    )}
                    <InputField name="email" type="email" placeholder="Correo Electrónico" Icon={Mail} required />
                    <InputField name="password" type="password" placeholder="Contraseña" Icon={Lock} required />

                    <button
                        type="submit"
                        disabled={pending}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-4 mt-6 font-bold shadow-lg hover:shadow-orange-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {pending ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                {isSignUp ? 'Crear mi cuenta' : 'Entrar ahora'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-zinc-100">
                    <button
                        type="button"
                        onClick={() => setIsSignUp((v) => !v)}
                        className="text-zinc-500 hover:text-orange-600 font-bold transition-all text-sm"
                    >
                        {isSignUp
                            ? '¿Ya tienes cuenta? Inicia sesión'
                            : '¿Eres nuevo? Crea una cuenta'}
                    </button>
                </div>
            </div>

            <div className="fixed bottom-6 text-white/80 text-sm font-medium">
                Uniform Logistic Ordering System
            </div>
        </div>
    );
}

function InputField({
    name,
    type = 'text',
    placeholder,
    Icon,
    required,
}: {
    name: string;
    type?: string;
    placeholder: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    required?: boolean;
}) {
    return (
        <div className="relative group">
            <Icon className="absolute left-4 top-3.5 text-zinc-400" size={20} />
            <input
                type={type}
                name={name}
                placeholder={placeholder}
                required={required}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-semibold text-zinc-700 placeholder:text-zinc-400"
            />
        </div>
    );
}
