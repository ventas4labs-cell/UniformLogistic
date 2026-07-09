import Link from 'next/link';

// Clean ledger footer: brand block, contact, nav — all hairlines.
export function LandingFooter() {
    return (
        <footer id="contacto" className="bg-[#16130F] text-[#F7F4EE]">
            <div className="mx-auto max-w-6xl px-6 py-20">
                <div className="grid gap-14 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                        <div className="flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/ul-logo.png"
                                alt="Uniform Logistic"
                                className="h-9 w-9 rounded-xl bg-white object-contain"
                            />
                            <span className="text-base font-bold tracking-tight">
                                Uniform Logistic
                            </span>
                        </div>
                        <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#F7F4EE]/55">
                            Manufactura textil de uniformes. Corte, costura,
                            bordado e impresión bajo un mismo techo, para
                            equipos de 10 a 1 000 personas en todo el país.
                        </p>
                    </div>

                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#F7F4EE]/40">
                            Contacto
                        </p>
                        <ul className="mt-5 space-y-3 text-sm">
                            <li>
                                <a
                                    href="mailto:ulogisticcr@gmail.com"
                                    className="text-[#F7F4EE]/75 transition-colors hover:text-[#EA580C]"
                                >
                                    ulogisticcr@gmail.com
                                </a>
                            </li>
                            <li className="text-[#F7F4EE]/55">San José, Costa Rica</li>
                            <li className="text-[#F7F4EE]/55">Lun – Vie · 8:00 – 17:00</li>
                        </ul>
                    </div>

                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#F7F4EE]/40">
                            Navegación
                        </p>
                        <ul className="mt-5 space-y-3 text-sm">
                            <li>
                                <Link
                                    href="/login"
                                    className="text-[#F7F4EE]/75 transition-colors hover:text-[#EA580C]"
                                >
                                    Iniciar sesión
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="#ventaja"
                                    className="text-[#F7F4EE]/75 transition-colors hover:text-[#EA580C]"
                                >
                                    La ventaja tecnológica
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#sectores"
                                    className="text-[#F7F4EE]/75 transition-colors hover:text-[#EA580C]"
                                >
                                    Sectores
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-16 flex flex-col gap-3 border-t border-[#F7F4EE]/12 pt-7 font-mono text-[10px] uppercase tracking-[0.2em] text-[#F7F4EE]/35 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        © {new Date().getFullYear()} Uniform Logistic · Costa Rica
                    </span>
                    <span>Manufactura textil de uniformes · Costa Rica</span>
                </div>
            </div>
        </footer>
    );
}
