import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SectionVideo } from './section-video';

// Closing band — one oversized question over the boutique footage,
// sunk under ink so the type and the two actions carry it.
export function LandingCta({ appHref }: { appHref: string | null }) {
    return (
        <section className="relative overflow-hidden border-t border-[#16130F]/15 bg-[#16130F] text-[#F7F4EE]">
            <SectionVideo
                src="/landing/boutique.mp4"
                poster="/landing/boutique-poster.jpg"
                className="opacity-30"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#16130F]/85 via-[#16130F]/60 to-[#16130F]/90"
            />
            <div className="relative mx-auto max-w-6xl px-6 py-32 text-center">
                <p
                    data-reveal
                    className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#F7F4EE]/55"
                >
                    Sin contratos de permanencia · Demo de 20 minutos
                </p>
                <h2
                    data-reveal
                    className="mx-auto mt-6 max-w-3xl font-sans text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl"
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
                        className="group inline-flex items-center gap-2 rounded-full bg-[#EA580C] px-8 py-4 text-sm font-bold text-[#F7F4EE] shadow-[0_12px_32px_-12px_rgba(234,88,12,0.6)] transition-colors hover:bg-[#F7F4EE] hover:text-[#16130F]"
                    >
                        Explorar el portal
                        <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-1"
                        />
                    </Link>
                    <a
                        href="mailto:ulogisticcr@gmail.com?subject=Solicitud%20de%20demo%20%E2%80%94%20Uniform%20Logistic"
                        className="inline-flex items-center gap-2 rounded-full border border-[#F7F4EE]/35 px-8 py-4 text-sm font-bold text-[#F7F4EE] transition-colors hover:border-[#F7F4EE] hover:bg-[#F7F4EE] hover:text-[#16130F]"
                    >
                        Solicitar una demo
                    </a>
                </div>
            </div>
        </section>
    );
}
