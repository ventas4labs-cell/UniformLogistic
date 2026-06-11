import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';

// ─── Industry solutions ──────────────────────────────────────────────
// Numbered ledger rows, staggered in by the orchestrator. Hover floods
// the row with ink and flips the type to ivory — one deliberate,
// memorable interaction instead of many small ones.

const SECTORS: { n: string; name: string; line: string }[] = [
    {
        n: '01',
        name: 'Banca y finanzas',
        line: 'Imagen impecable en cada sucursal, tallas renovadas sin fricción.'
    },
    {
        n: '02',
        name: 'Seguridad privada',
        line: 'Dotación completa por oficial, reposiciones y stock de respaldo.'
    },
    {
        n: '03',
        name: 'Corporativo y oficinas',
        line: 'Identidad bordada o impresa, pedidos por departamento.'
    },
    {
        n: '04',
        name: 'Industria y operaciones',
        line: 'Prendas de trabajo resistentes, entregadas por etapas verificables.'
    }
];

export function LandingIndustries() {
    return (
        <section id="sectores" className="relative">
            <div className="mx-auto max-w-6xl px-6 py-28">
                <div data-reveal className="mb-14 flex items-end justify-between gap-6">
                    <h2 className="font-sans text-4xl font-extrabold tracking-tight sm:text-5xl">
                        Sectores
                    </h2>
                    <p className="hidden max-w-xs pb-2 text-sm leading-relaxed text-[#16130F]/55 sm:block">
                        Equipos de 10 a 1 000 personas visten con nosotros en todo el
                        país.
                    </p>
                </div>

                <div className="grid gap-12 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                    <div data-reveal-group className="self-start border-t border-[#16130F]/15">
                        {SECTORS.map((s) => (
                            <div
                                key={s.n}
                                data-reveal-item
                                className="group grid cursor-default grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-baseline gap-4 rounded-2xl border-b border-[#16130F]/15 px-4 py-8 transition-colors duration-300 hover:bg-[#16130F] sm:px-5"
                            >
                                <span className="font-mono text-xs text-[#EA580C]">
                                    {s.n}
                                </span>
                                <div>
                                    <h3 className="font-sans text-2xl font-extrabold tracking-tight transition-colors duration-300 group-hover:text-[#F7F4EE] sm:text-3xl">
                                        {s.name}
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-[#16130F]/55 transition-colors duration-300 group-hover:text-[#F7F4EE]/60">
                                        {s.line}
                                    </p>
                                </div>
                                <ArrowUpRight
                                    size={20}
                                    className="justify-self-end text-[#16130F]/30 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[#EA580C]"
                                />
                            </div>
                        ))}
                    </div>

                    {/* The workshop behind the sectors — garments on the line. */}
                    <figure
                        data-reveal
                        className="relative hidden self-stretch overflow-hidden rounded-3xl border border-[#16130F]/15 lg:block"
                    >
                        <Image
                            src="/landing/taller-blanco.jpg"
                            alt="Máquinas de bordado trabajando sobre uniformes blancos en el taller"
                            fill
                            sizes="(min-width: 1024px) 33vw, 100vw"
                            className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#16130F]/50 via-transparent to-transparent" />
                        <figcaption className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F7F4EE]/85">
                            [ Producción en curso — taller UL ]
                        </figcaption>
                    </figure>
                </div>
            </div>
        </section>
    );
}
