import Link from 'next/link';
import { ArrowRight, History, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/login/actions';
import { createClient } from '@/utils/supabase/server';

const ADMIN_EMAIL = 'ulogisticcr@gmail.com';

export default async function HomePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = (user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;

    return (
        <div className="flex flex-col min-h-[calc(100vh-3rem)] -mx-4 lg:-mx-8 -my-6 bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 text-white relative overflow-hidden">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] bg-orange-600/30 rounded-full blur-[120px] pointer-events-none" />

            <div className="absolute top-6 right-6 z-50">
                <form action={signOutAction}>
                    <button
                        type="submit"
                        className="group bg-white/10 backdrop-blur-md p-2.5 pr-4 rounded-full hover:bg-white/20 transition-all text-white border border-white/10 shadow-lg flex items-center gap-2"
                        title="Cerrar Sesión"
                    >
                        <div className="bg-white/20 p-1.5 rounded-full group-hover:bg-white/30 transition-colors">
                            <LogOut size={14} />
                        </div>
                        <span className="text-xs font-medium opacity-90">Salir</span>
                    </button>
                </form>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 w-full max-w-4xl mx-auto mt-10 mb-10">
                <div className="relative mb-8 group">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full transform group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative bg-white/90 backdrop-blur-sm p-6 rounded-[2rem] shadow-2xl w-40 h-40 md:w-52 md:h-52 flex items-center justify-center transform hover:scale-105 transition-all duration-300 border border-white/50">
                        <span className="text-5xl md:text-6xl font-black text-orange-600">UL</span>
                    </div>
                </div>

                <div className="space-y-4 mb-10">
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none drop-shadow-sm">
                        Uniform{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-100 to-orange-50">
                            Logistic
                        </span>
                    </h1>
                    <p className="text-orange-100 text-base md:text-xl font-light max-w-xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
                        Gestión inteligente de uniformes para profesionales de seguridad.
                    </p>
                </div>

                <div className="w-full max-w-sm space-y-4 flex flex-col items-center">
                    <Link
                        href="/catalog"
                        className="group relative w-full py-4 px-6 bg-white text-orange-600 rounded-xl font-bold text-lg shadow-xl hover:shadow-orange-900/20 transition-all hover:-translate-y-1 active:scale-95 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        <span className="relative flex items-center justify-center gap-2">
                            Iniciar Nuevo Pedido
                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </span>
                    </Link>

                    <Link
                        href="/orders"
                        className="w-full py-3.5 px-6 bg-black/20 backdrop-blur-md text-white rounded-xl font-semibold border border-white/10 hover:bg-black/30 hover:border-white/20 transition-all flex items-center justify-center gap-2 active:scale-95 text-base"
                    >
                        <History size={18} className="text-orange-200" />
                        <span>Historial de Pedidos</span>
                    </Link>

                    {isAdmin && (
                        <Link
                            href="/admin"
                            className="w-full py-3 px-6 bg-white/5 backdrop-blur-sm text-white rounded-xl text-sm font-medium border border-white/10 hover:bg-white/10 transition-all"
                        >
                            Panel Administrador
                        </Link>
                    )}
                </div>
            </div>

            <div className="p-4 text-center z-10">
                <p className="text-orange-200/60 text-[10px] font-medium tracking-widest uppercase">
                    Premium Enterprise Solution
                </p>
            </div>
        </div>
    );
}
