import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PortalMockup } from './portal-mockup';
import { SectionVideo } from './section-video';

// Masked line for the GSAP "sunrise" reveal — the inner .hero-line
// rises out of the overflow-hidden wrapper.
function SunriseLine({
    children,
    className = ''
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span className="block overflow-hidden pb-[0.06em]">
            <span className={`hero-line block will-change-transform ${className}`}>
                {children}
            </span>
        </span>
    );
}

const STATS: { value: string; label: string }[] = [
    { value: '7', label: 'etapas de producción visibles' },
    { value: '1', label: 'enlace por empresa para pedir' },
    { value: '0', label: 'llamadas para saber su pedido' },
    { value: '24/7', label: 'stock de su empresa en línea' }
];

export function LandingHero({ appHref }: { appHref: string | null }) {
    return (
        <section className="relative overflow-hidden">
            {/* Living backdrop — the high-speed embroidery line. The veil is
                directional: solid ivory over the type column on the left,
                clearing to the right so the footage reads, then a vertical
                fade anchors the stats row back on solid paper. */}
            <SectionVideo
                src="/landing/embroidery-fast.mp4"
                poster="/landing/embroidery-fast-poster.jpg"
                className="opacity-65"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F7F4EE] from-30% via-[#F7F4EE]/70 via-60% to-[#F7F4EE]/10"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F7F4EE]/55 via-transparent via-35% to-[#F7F4EE] to-[92%]"
            />
            {/* Pattern-paper grid — faint cutting-table backdrop. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        'linear-gradient(to right, rgba(22,19,15,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(22,19,15,0.05) 1px, transparent 1px)',
                    backgroundSize: '72px 72px',
                    maskImage:
                        'radial-gradient(ellipse 90% 80% at 50% 0%, black 35%, transparent 100%)',
                    WebkitMaskImage:
                        'radial-gradient(ellipse 90% 80% at 50% 0%, black 35%, transparent 100%)'
                }}
            />
            {/* Sunrise glow behind the headline. */}
            <div
                aria-hidden
                data-sun
                data-parallax="0.25"
                className="pointer-events-none absolute left-1/2 top-[-12rem] h-[34rem] w-[54rem] -translate-x-1/2 rounded-full opacity-90 blur-3xl"
                style={{
                    background:
                        'radial-gradient(closest-side, rgba(234,88,12,0.22), rgba(234,88,12,0.07) 55%, transparent 75%)'
                }}
            />

            <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
                <p
                    data-hero-fade
                    className="mb-10 font-mono text-[11px] uppercase tracking-[0.3em] text-[#16130F]/55"
                >
                    Manufactura textil <span className="text-[#EA580C]">+</span> software
                    propio — Costa Rica
                </p>

                <h1 className="font-sans text-[11.5vw] font-extrabold leading-[1.02] tracking-tight sm:text-[8.5vw] lg:text-[5.6rem]">
                    <SunriseLine>Uniformes hechos</SunriseLine>
                    <SunriseLine>en Costa Rica.</SunriseLine>
                    <SunriseLine className="text-[#EA580C]">
                        Pedidos en segundos.
                    </SunriseLine>
                </h1>

                <div className="mt-12 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
                    <div data-hero-fade className="max-w-md">
                        <p className="text-lg leading-relaxed text-[#16130F]/70">
                            La única manufactura de uniformes del país con software
                            propio: cada pedido, cada etapa de producción y el stock de
                            su empresa, visibles en un portal hecho a su medida.
                        </p>
                        <div className="mt-8 flex flex-wrap items-center gap-4">
                            <Link
                                href={appHref ?? '/login'}
                                className="group inline-flex items-center gap-2 rounded-full bg-[#EA580C] px-8 py-4 text-sm font-bold text-[#F7F4EE] shadow-[0_12px_32px_-12px_rgba(234,88,12,0.55)] transition-colors hover:bg-[#16130F]"
                            >
                                Explorar el portal
                                <ArrowRight
                                    size={15}
                                    className="transition-transform group-hover:translate-x-1"
                                />
                            </Link>
                            <a
                                href="mailto:ulogisticcr@gmail.com?subject=Solicitud%20de%20demo%20%E2%80%94%20Uniform%20Logistic"
                                className="inline-flex items-center gap-2 rounded-full border border-[#16130F]/20 px-8 py-4 text-sm font-bold transition-colors hover:border-[#16130F] hover:bg-[#16130F] hover:text-[#F7F4EE]"
                            >
                                Solicitar una demo
                            </a>
                        </div>
                    </div>

                    {/* The product, floating over the cutting table. */}
                    <div data-hero-fade className="relative md:justify-self-end">
                        <PortalMockup />
                    </div>
                </div>

                {/* Hairline stats — measurement marks on the pattern paper. */}
                <div
                    data-reveal
                    className="mt-24 grid grid-cols-2 border-t border-[#16130F]/15 lg:grid-cols-4"
                >
                    {STATS.map((s, i) => (
                        <div
                            key={s.label}
                            className={`flex flex-col gap-2 py-7 pr-6 ${
                                i > 0 ? 'lg:border-l lg:border-[#16130F]/15 lg:pl-6' : ''
                            } ${i % 2 === 1 ? 'border-l border-[#16130F]/15 pl-6 lg:border-l' : ''}`}
                        >
                            <span className="font-sans text-4xl font-extrabold tracking-tight text-[#EA580C]">
                                {s.value}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#16130F]/55">
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
