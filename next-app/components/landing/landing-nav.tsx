import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

// Hairline sticky nav. Logged-in visitors get a single "Ir a la app"
// action; prospects get Iniciar / Solicitar demo.
export function LandingNav({ appHref }: { appHref: string | null }) {
    return (
        <header
            data-hero-fade
            className="sticky top-0 z-50 border-b border-[#16130F]/10 bg-[#F7F4EE]/85 backdrop-blur-md"
        >
            <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
                <Link href="/" className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center bg-[#16130F] font-display text-[13px] font-black tracking-tight text-[#F7F4EE]">
                        UL
                    </span>
                    <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em]">
                        Uniform Logistic
                    </span>
                </Link>

                <nav className="hidden items-center gap-10 font-mono text-[11px] uppercase tracking-[0.22em] text-[#16130F]/60 md:flex">
                    <a href="#ventaja" className="transition-colors hover:text-[#EA580C]">
                        La ventaja
                    </a>
                    <a href="#sectores" className="transition-colors hover:text-[#EA580C]">
                        Sectores
                    </a>
                    <a href="#contacto" className="transition-colors hover:text-[#EA580C]">
                        Contacto
                    </a>
                </nav>

                <div className="flex items-center gap-5">
                    {appHref ? (
                        <Link
                            href={appHref}
                            className="group inline-flex items-center gap-1.5 bg-[#16130F] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#F7F4EE] transition-colors hover:bg-[#EA580C]"
                        >
                            Ir a la app
                            <ArrowUpRight
                                size={13}
                                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            />
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="hidden font-mono text-[11px] uppercase tracking-[0.22em] text-[#16130F]/70 transition-colors hover:text-[#16130F] sm:inline"
                            >
                                Iniciar
                            </Link>
                            <Link
                                href="/login"
                                className="group inline-flex items-center gap-1.5 bg-[#16130F] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#F7F4EE] transition-colors hover:bg-[#EA580C]"
                            >
                                Explorar el portal
                                <ArrowUpRight
                                    size={13}
                                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                />
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}
