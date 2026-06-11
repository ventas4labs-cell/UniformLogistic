import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Closing band — one oversized question, two actions.
export function LandingCta({ appHref }: { appHref: string | null }) {
    return (
        <section className="relative overflow-hidden border-t border-[#16130F]/15">
            <div
                aria-hidden
                data-parallax="0.2"
                className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full blur-3xl"
                style={{
                    background:
                        'radial-gradient(closest-side, rgba(234,88,12,0.14), transparent 75%)'
                }}
            />
            <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
                <p
                    data-reveal
                    className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#16130F]/50"
                >
                    Sin contratos de permanencia · Demo de 20 minutos
                </p>
                <h2
                    data-reveal
                    className="mx-auto mt-6 max-w-4xl font-display text-6xl font-black uppercase leading-[0.92] tracking-tight sm:text-7xl"
                >
                    ¿Listo para reclamar
                    <br />
                    <span className="text-[#EA580C]">su tiempo?</span>
                </h2>
                <div
                    data-reveal
                    className="mt-12 flex flex-wrap items-center justify-center gap-4"
                >
                    <Link
                        href={appHref ?? '/login'}
                        className="group inline-flex items-center gap-2 bg-[#16130F] px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] text-[#F7F4EE] transition-colors hover:bg-[#EA580C]"
                    >
                        Explorar el portal
                        <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-1"
                        />
                    </Link>
                    <a
                        href="mailto:ulogisticcr@gmail.com?subject=Solicitud%20de%20demo%20%E2%80%94%20Uniform%20Logistic"
                        className="inline-flex items-center gap-2 border border-[#16130F]/25 px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] transition-colors hover:border-[#16130F] hover:bg-[#16130F] hover:text-[#F7F4EE]"
                    >
                        Solicitar una demo
                    </a>
                </div>
            </div>
        </section>
    );
}
