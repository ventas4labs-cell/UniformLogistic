import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Lock, Mail, Loader2, ArrowRight, Building, Phone, User } from 'lucide-react';

interface LoginProps {
    onSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Sign Up Fields
    const [fullName, setFullName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            company_name: companyName,
                            phone: phoneNumber,
                        }
                    }
                });
                if (error) throw error;
                setMessage('¡Cuenta creada! Por favor revisa tu correo para verificación.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                onSuccess();
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error durante la autenticación.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 p-6 relative overflow-hidden font-sans">
            {/* Background Decor */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-orange-900/20 rounded-full blur-[80px]"></div>

            <div className="bg-white p-8 lg:p-12 rounded-3xl shadow-2xl w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="bg-orange-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-orange-600 shadow-sm ring-1 ring-orange-100">
                        <Lock size={36} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                        {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
                    </h1>
                    <p className="text-gray-500 font-medium">
                        {isSignUp
                            ? 'Únete a Uniform Logistic hoy'
                            : 'Accede a tu panel de pedidos'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm mb-8 flex items-center gap-3 border border-red-100">
                        <span className="text-lg">⚠️</span>
                        <span className="font-semibold">{error}</span>
                    </div>
                )}

                {message && (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-8 flex items-center gap-3 border border-green-100">
                        <span className="text-lg">✅</span>
                        <span className="font-semibold">{message}</span>
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    {isSignUp && (
                        <>
                            <div className="relative group">
                                <Building className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Nombre de la Empresa"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                                    required
                                />
                            </div>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Nombre Completo"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                                    required
                                />
                            </div>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                    type="tel"
                                    placeholder="Teléfono"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="relative group">
                        <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input
                            type="email"
                            placeholder="Correo Electrónico"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                            required
                        />
                    </div>

                    <div className="relative group">
                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                        <input
                            type="password"
                            placeholder="Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all font-semibold text-gray-700 placeholder:text-gray-400"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-4 mt-6 font-bold shadow-lg hover:shadow-orange-500/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                {isSignUp ? 'Crear mi cuenta' : 'Entrar ahora'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>
                <div className="mt-8 text-center pt-6 border-t border-gray-100">
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                        className="text-gray-500 hover:text-orange-600 font-bold transition-all text-sm"
                    >
                        {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿Eres nuevo? Crea una cuenta'}
                    </button>
                </div>
            </div>

            <div className="fixed bottom-6 text-white/80 text-sm font-medium">
                Uniform Logistic Ordering System v1.1
            </div>
        </div>
    );
};

export default Login;
