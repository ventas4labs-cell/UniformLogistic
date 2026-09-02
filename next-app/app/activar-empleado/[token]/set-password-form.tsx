'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import { setEmployeePasswordAction } from '@/app/(admin)/admin/rrhh/actions';

export function SetPasswordForm({ token }: { token: string }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const submit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setError(null);
        if (password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        if (password !== confirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        setSaving(true);
        const res = await setEmployeePasswordAction(token, password);
        setSaving(false);
        if (res?.error) {
            setError(res.error);
            return;
        }
        setDone(true);
    };

    if (done) {
        return (
            <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                    <Check size={24} className="text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm text-gray-700 dark:text-zinc-300">
                    ¡Listo! Tu cuenta quedó activada. Ya podés iniciar sesión con
                    tu correo y tu nueva contraseña.
                </p>
                <Link
                    href="/login"
                    className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm"
                >
                    Iniciar sesión
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                    Nueva contraseña
                </span>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                    required
                    minLength={8}
                    autoComplete="new-password"
                />
            </label>
            <label className="block">
                <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400 mb-1">
                    Repetir contraseña
                </span>
                <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repetí la contraseña"
                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-transparent"
                    required
                    autoComplete="new-password"
                />
            </label>

            {error && (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm border border-red-200 dark:border-red-900/50">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2.5 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Activar mi cuenta
            </button>
        </form>
    );
}
