import Image from 'next/image';

// ─── Workshop image strip ────────────────────────────────────────────
// Three real-production frames between the hero and the tech section —
// proof the software tracks an actual workshop. Hairline frames, mono
// plate captions, staggered in by the orchestrator.

const SHOTS: { src: string; alt: string; caption: string }[] = [
    {
        src: '/landing/logo-stitch.jpg',
        alt: 'Cabezal de bordado aplicando un logo corporativo sobre tela gris',
        caption: '[ 01 — Bordado de identidad ]'
    },
    {
        src: '/landing/maquinas.jpg',
        alt: 'Línea de máquinas de bordado industrial trabajando en serie',
        caption: '[ 02 — Línea de producción ]'
    },
    {
        src: '/landing/hilos.jpg',
        alt: 'Máquina bordadora con hilos de colores aplicando un emblema',
        caption: '[ 03 — Emblemas y parches ]'
    }
];

export function LandingStrip() {
    return (
        <section className="border-y border-[#16130F]/10 bg-[#F1EDE4]">
            <div
                data-reveal-group
                className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 py-12 sm:grid-cols-3"
            >
                {SHOTS.map((s) => (
                    <figure
                        key={s.src}
                        data-reveal-item
                        className="group relative overflow-hidden rounded-3xl shadow-[0_18px_44px_-22px_rgba(22,19,15,0.35)]"
                    >
                        <div className="relative aspect-[4/3] sm:aspect-[3/4] lg:aspect-[4/3]">
                            <Image
                                src={s.src}
                                alt={s.alt}
                                fill
                                sizes="(min-width: 640px) 33vw, 100vw"
                                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#16130F]/55 via-transparent to-transparent" />
                        </div>
                        <figcaption className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F7F4EE]/85">
                            {s.caption}
                        </figcaption>
                    </figure>
                ))}
            </div>
        </section>
    );
}
