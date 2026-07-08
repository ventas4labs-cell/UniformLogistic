import { ArrowRight } from 'lucide-react';
import { SectionVideo } from './section-video';

const QUOTE_MAILTO =
    'mailto:ulogisticcr@gmail.com?subject=Cotizaci%C3%B3n%20de%20uniformes%20%E2%80%94%20Uniform%20Logistic';

// Closing band — one oversized question over the boutique footage,
// sunk under ink so the type and the two actions carry it.
export function LandingCta({ quoteHref = null }: { quoteHref?: string | null }) {
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
                    Cotización sin costo · Muestra física para aprobación
                </p>
                <h2
                    data-reveal
                    className="mx-auto mt-6 max-w-3xl font-sans text-5xl font-extrabold leading-[1.04] tracking-tight sm:text-6xl"
                >
                    ¿Listo para vestir
                    <br />
                    <span className="text-[#EA580C]">su marca?</span>
                </h2>
                <div
                    data-reveal
                    className="mt-12 flex flex-wrap items-center justify-center gap-4"
                >
                    <a
                        href={quoteHref ?? QUOTE_MAILTO}
                        className="group inline-flex items-center gap-2 rounded-full bg-[#EA580C] px-8 py-4 text-sm font-bold text-[#F7F4EE] shadow-[0_12px_32px_-12px_rgba(234,88,12,0.6)] transition-colors hover:bg-[#F7F4EE] hover:text-[#16130F]"
                    >
                        Cotizar uniformes
                        <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-1"
                        />
                    </a>
                    <a
                        href="mailto:ulogisticcr@gmail.com?subject=Visitar%20el%20taller%20%E2%80%94%20Uniform%20Logistic"
                        className="inline-flex items-center gap-2 rounded-full border border-[#F7F4EE]/35 px-8 py-4 text-sm font-bold text-[#F7F4EE] transition-colors hover:border-[#F7F4EE] hover:bg-[#F7F4EE] hover:text-[#16130F]"
                    >
                        Visitar el taller
                    </a>
                </div>
            </div>
        </section>
    );
}
