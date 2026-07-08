import { SectionVideo } from './section-video';

// ─── The workshop ────────────────────────────────────────────────────
// Contrast flip to warm black. Copy carries the manufacturing story:
// cut, sew, brand, finish — all under one roof, with a dashed "stitch"
// rule that sews itself down the section as you scroll (data-stitch).

const FEATURES: { n: string; title: string; body: string }[] = [
    {
        n: '01',
        title: 'Corte y costura propios',
        body: 'Máquinas industriales y patronaje ajustado por talla en tallas S a 5XL. Telas seleccionadas para durar el turno completo y aguantar el lavado industrial.'
    },
    {
        n: '02',
        title: 'Marca aplicada en el taller',
        body: 'Bordado en cabezales de alta velocidad, impresión digital y ploter para lotes grandes. Cada logo se aplica sin salir del taller — un solo responsable de principio a fin.'
    },
    {
        n: '03',
        title: 'Control de calidad prenda por prenda',
        body: 'Cada lote se revisa a mano antes de salir: costura, aplicación de marca, tallas y empaque. Si algo no queda perfecto, no llega a su gente.'
    }
];

export function LandingAdvantage() {
    return (
        <section
            id="ventaja"
            className="relative overflow-hidden bg-[#16130F] text-[#F7F4EE]"
        >
            {/* Section backdrop — the industrial printer at work, sunk
                deep under ink so the copy carries the section. */}
            <SectionVideo
                src="/landing/printer.mp4"
                poster="/landing/printer-poster.jpg"
                className="opacity-[0.13]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#16130F]/70 via-[#16130F]/35 to-[#16130F]"
            />
            {/* Parallax ember glow */}
            <div
                aria-hidden
                data-parallax="0.35"
                className="pointer-events-none absolute -right-40 top-1/4 h-[30rem] w-[30rem] rounded-full blur-3xl"
                style={{
                    background:
                        'radial-gradient(closest-side, rgba(234,88,12,0.16), transparent 70%)'
                }}
            />

            <div className="relative mx-auto max-w-6xl px-6 py-28">
                <div data-reveal className="max-w-3xl">
                    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#F7F4EE]/45">
                        El taller
                    </p>
                    <h2 className="mt-6 font-sans text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl">
                        Corte. Costura.
                        <br />
                        Marca.
                        <br />
                        <span className="text-[#EA580C]">Todo bajo un mismo techo.</span>
                    </h2>
                    <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#F7F4EE]/65">
                        Nuestro taller confecciona los uniformes desde la tela
                        cruda hasta la prenda marcada y empacada. Sin subcontratos
                        que no vemos, sin lotes que se pierden entre proveedores —
                        un solo taller, un solo responsable, una sola calidad.
                    </p>
                </div>

                <div className="mt-20 grid gap-0 md:grid-cols-[1px_minmax(0,1fr)] md:gap-16">
                    {/* Stitch rule — sews in with scroll */}
                    <div
                        aria-hidden
                        data-stitch
                        className="hidden w-px md:block"
                        style={{
                            backgroundImage:
                                'repeating-linear-gradient(to bottom, rgba(234,88,12,0.9) 0 7px, transparent 7px 15px)'
                        }}
                    />

                    <div data-reveal-group className="space-y-0">
                        {FEATURES.map((f) => (
                            <article
                                key={f.n}
                                data-reveal-item
                                className="group grid gap-4 border-t border-[#F7F4EE]/12 py-10 transition-colors first:border-t-0 md:grid-cols-[6rem_minmax(0,18rem)_minmax(0,1fr)] md:gap-10"
                            >
                                <span className="font-mono text-sm text-[#EA580C]">
                                    {f.n}
                                </span>
                                <h3 className="font-sans text-2xl font-extrabold leading-snug tracking-tight transition-colors group-hover:text-[#EA580C]">
                                    {f.title}
                                </h3>
                                <p className="leading-relaxed text-[#F7F4EE]/60">
                                    {f.body}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>

                {/* The workshop, full color: intricate embroidery footage. */}
                <figure
                    data-reveal
                    className="relative mt-16 h-72 overflow-hidden rounded-3xl border border-[#F7F4EE]/12 sm:h-96"
                >
                    <SectionVideo
                        src="/landing/embroidery-detail.mp4"
                        poster="/landing/embroidery-detail-poster.jpg"
                    />
                    <div
                        aria-hidden
                        className="absolute inset-0 bg-gradient-to-t from-[#16130F]/60 via-transparent to-[#16130F]/20"
                    />
                    <figcaption className="absolute bottom-5 left-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#F7F4EE]/80">
                        [ Taller — bordado industrial en vivo ]
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}
