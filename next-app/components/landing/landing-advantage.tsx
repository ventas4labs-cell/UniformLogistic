// ─── The technological advantage ─────────────────────────────────────
// Contrast flip to warm black. ROI-framed copy: the software exists to
// give operations teams their hours back. A dashed "stitch" rule sews
// itself down the section as you scroll (data-stitch).

const FEATURES: { n: string; title: string; body: string }[] = [
    {
        n: '01',
        title: 'Producción transparente',
        body: 'Siga cada orden por las 7 etapas del taller — corte, maquila, impresión, bordado y más — en tiempo real. Sin pedir reportes, sin esperar respuestas.'
    },
    {
        n: '02',
        title: 'Pedidos sin fricción',
        body: 'Cada empresa recibe un enlace individual: su equipo elige tallas y cantidades en minutos. Sin usuarios, sin contraseñas, sin hojas de cálculo.'
    },
    {
        n: '03',
        title: 'Stock administrado',
        body: 'Guardamos su inventario de uniformes en nuestra bodega y usted lo ve, reserva y despacha desde el portal. Cero llamadas para saber qué queda.'
    }
];

export function LandingAdvantage() {
    return (
        <section
            id="ventaja"
            className="relative overflow-hidden bg-[#16130F] text-[#F7F4EE]"
        >
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
                        La ventaja tecnológica
                    </p>
                    <h2 className="mt-6 font-display text-5xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
                        Menos correos.
                        <br />
                        Menos llamadas.
                        <br />
                        <span className="text-[#EA580C]">Más horas para su operación.</span>
                    </h2>
                    <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#F7F4EE]/65">
                        Ningún otro taller textil en Costa Rica le da esto: software
                        propio que convierte la compra de uniformes — perseguir
                        proveedores, consolidar tallas, adivinar fechas — en minutos de
                        gestión al mes. Ese es el retorno: el tiempo de su gente.
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
                                <h3 className="font-display text-2xl font-extrabold uppercase leading-tight tracking-tight transition-colors group-hover:text-[#EA580C]">
                                    {f.title}
                                </h3>
                                <p className="leading-relaxed text-[#F7F4EE]/60">
                                    {f.body}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>

                {/* Photography slot — swap for taller/embroidery footage. */}
                <figure
                    data-reveal
                    className="relative mt-16 h-72 overflow-hidden border border-[#F7F4EE]/12 sm:h-96"
                >
                    <div
                        aria-hidden
                        className="absolute inset-0"
                        style={{
                            backgroundImage:
                                'repeating-linear-gradient(45deg, rgba(247,244,238,0.05) 0 2px, transparent 2px 14px), repeating-linear-gradient(-45deg, rgba(247,244,238,0.04) 0 2px, transparent 2px 14px)'
                        }}
                    />
                    <div
                        aria-hidden
                        data-parallax="0.15"
                        className="absolute inset-0"
                        style={{
                            background:
                                'radial-gradient(ellipse 60% 70% at 30% 60%, rgba(234,88,12,0.14), transparent 70%)'
                        }}
                    />
                    <figcaption className="absolute bottom-5 left-5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#F7F4EE]/45">
                        [ Fotografía — taller de bordado, San José ]
                    </figcaption>
                </figure>
            </div>
        </section>
    );
}
