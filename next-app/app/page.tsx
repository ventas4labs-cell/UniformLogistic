// ─── Landing page — Uniform Logistic ─────────────────────────────────
// Restructured to mirror the DoorDash for Business marketing layout:
//   1. White top nav
//   2. Hero (dark orange) with embroidery photo on the right
//   3. "Best of confección, built for businesses" — photo left / copy right
//   4. "Más catálogo. Más control. Más soporte." — 3 columns w/ photos
//   5. Trust strip (logo row of brands)
//   6. Comparison block — Proveedor tradicional vs Uniform Logistic
//   7. Testimonial (dark)
//   8. Get started — two action cards (place first order / get help)
//   9. Employee experience — photo right, copy left, pink-tint bg
//  10. Products row — 3 illustrated service cards
//  11. FAQ accordion (dark orange bg)
//  12. Bottom CTA (orange bg)
//  13. Footer (dark)
//
// The root URL always shows the landing page (it's the "main link" we
// share). Logged-in visitors aren't redirected away — the top nav swaps
// Iniciar/Registrarse for an "Ir a la app" button into their dashboard.
//
// Photos that need files in next-app/public/ (alt-text falls through
// gracefully if a file is missing):
//   /embroidery-machines.jpg   (hero — the embroidery machine photo)
//   /uniforms-stack.jpg        (section 2)
//   /employee-team.jpg         (employee experience)

import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { landingPath } from '@/lib/admin-acting-company';
import {
    ArrowRight,
    Boxes,
    Check,
    Factory,
    FileSpreadsheet,
    Layers,
    PackageSearch,
    Receipt,
    Search,
    Shirt,
    ShoppingCart,
    Sparkles,
    Truck,
    Wallet,
    Globe,
    Plus
} from 'lucide-react';

export default async function Home() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    // Logged-in visitors stay on the landing page; the nav gives them a
    // one-click jump into their app (admin panel or customer dashboard).
    const appHref = user ? landingPath(user.email) : null;

    return (
        <main className="min-h-screen bg-white text-zinc-900">
            <TopNav appHref={appHref} />
            <Hero />
            <BestOfSection />
            <MoreSelectionSection />
            <TrustStrip />
            <ComparisonSection />
            <TestimonialSection />
            <GetStartedSection />
            <EmployeeExperienceSection />
            <ProductsSection />
            <FaqSection />
            <BottomCTA />
            <Footer />
        </main>
    );
}

// ── 1. TOP NAV ─────────────────────────────────────────────────────────

const NAV_LINKS = [
    { label: 'Servicios', href: '#servicios' },
    { label: 'Cómo funciona', href: '#funcionamiento' },
    { label: 'Por industria', href: '#industrias' },
    { label: 'Recursos', href: '#recursos' },
    { label: 'Hablar con ventas', href: '#contacto' }
];

function TopNav({ appHref }: { appHref: string | null }) {
    return (
        <header className="sticky top-0 z-50 bg-white border-b border-zinc-200">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <Link
                    href="/"
                    className="flex items-center gap-2 font-semibold tracking-tight"
                >
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-700 grid place-items-center text-xs font-black text-white">
                        UL
                    </span>
                    <span className="text-sm">
                        <span className="font-extrabold">Uniform Logistic</span>{' '}
                        <span className="text-zinc-500 font-medium">for Business</span>
                    </span>
                </Link>
                <nav className="hidden lg:flex items-center gap-8 text-sm text-zinc-700">
                    {NAV_LINKS.map((l) => (
                        <a key={l.href} href={l.href} className="hover:text-zinc-900 font-medium">
                            {l.label}
                        </a>
                    ))}
                </nav>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        aria-label="Buscar"
                        className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-600"
                    >
                        <Search size={18} />
                    </button>
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-zinc-500 font-semibold px-2">
                        <Globe size={14} /> CR
                    </span>
                    {appHref ? (
                        <Link
                            href={appHref}
                            className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                        >
                            Ir a la app
                            <ArrowRight size={15} />
                        </Link>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="text-sm font-semibold text-zinc-800 hover:text-zinc-950"
                            >
                                Iniciar
                            </Link>
                            <Link
                                href="/login"
                                className="text-sm font-bold px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                            >
                                Registrarse
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

// ── 2. HERO ────────────────────────────────────────────────────────────

function Hero() {
    return (
        <section
            id="servicios"
            className="bg-gradient-to-br from-orange-900 via-orange-800 to-amber-900 text-white"
        >
            <div className="max-w-7xl mx-auto px-6 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight uppercase leading-[1.02]">
                        Vestí a tu equipo con Uniform Logistic
                    </h1>
                    <p className="mt-6 text-base sm:text-lg text-orange-50/90 max-w-xl leading-relaxed">
                        Planificá los uniformes de tu empresa con un catálogo a tu
                        medida, stock en tiempo real, despacho en planta y facturación
                        electrónica — todo desde un solo panel, 24/7.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-orange-700 font-bold text-sm shadow-lg hover:bg-orange-50 transition-colors"
                        >
                            Registrate
                        </Link>
                        <a
                            href="#contacto"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-full border border-white/40 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
                        >
                            Solicitar demo
                        </a>
                    </div>
                </div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/embroidery-machines.jpg"
                        alt="Máquinas de bordado industrial confeccionando uniformes Uniform Logistic"
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>
        </section>
    );
}

// ── 3. BEST OF SECTION ─────────────────────────────────────────────────

function BestOfSection() {
    return (
        <section id="funcionamiento" className="bg-white">
            <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/uniforms-stack.jpg"
                        alt="Pila de uniformes empresariales listos para despacho"
                        className="w-full h-full object-cover"
                    />
                </div>
                <div>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-orange-700">
                        Lo mejor de la confección, hecho para empresas.
                    </h2>
                    <p className="mt-5 text-base text-zinc-700 leading-relaxed max-w-xl">
                        Uniform Logistic combina la flexibilidad de un proveedor
                        artesanal con la previsibilidad de una operación industrial.
                        Diseñamos un catálogo a la medida de cada empresa, mantenemos
                        stock buffer para reposiciones rápidas, y facturamos
                        electrónicamente desde el primer pedido — sin papel, sin
                        intermediarios.
                    </p>
                </div>
            </div>
        </section>
    );
}

// ── 4. MORE SELECTION SECTION (3-column highlight) ─────────────────────

function MoreSelectionSection() {
    const cards: Array<{
        eyebrow: string;
        title: string;
        desc: string;
        Icon: React.ComponentType<{ size?: number; className?: string }>;
    }> = [
        {
            eyebrow: '99+ SKUS',
            title: 'Más selección',
            desc: 'Camisas, jackets, pantalones, accesorios — con tallas H · / M · / cintura / inseam. El catálogo crece según tu necesidad sin extras de setup.',
            Icon: Shirt
        },
        {
            eyebrow: 'STOCK BUFFER',
            title: 'Más control',
            desc: 'Definí un mínimo por talla y modelo. Mantenemos esa reserva todo el año para que la incorporación de personal nuevo no espere por confección.',
            Icon: Boxes
        },
        {
            eyebrow: 'FE V4.4 + SOPORTE',
            title: 'Más respaldo',
            desc: 'Facturación electrónica firmada, notas de crédito automatizadas, reportes fiscales D-104 y un equipo dedicado que te acompaña en cada despacho.',
            Icon: ShieldIcon
        }
    ];
    return (
        <section className="bg-orange-50">
            <div className="max-w-7xl mx-auto px-6 py-20">
                <h2 className="text-center text-3xl sm:text-4xl font-black tracking-tight mb-12">
                    Más catálogo. Más control. Más soporte.
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {cards.map((c) => (
                        <div
                            key={c.title}
                            className="bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <div className="aspect-[5/3] bg-gradient-to-br from-orange-100 via-amber-100 to-rose-100 grid place-items-center">
                                <c.Icon size={64} className="text-orange-700" />
                            </div>
                            <div className="p-6">
                                <p className="text-[11px] font-black uppercase tracking-widest text-orange-700">
                                    {c.eyebrow}
                                </p>
                                <h3 className="mt-1 text-xl font-extrabold">{c.title}</h3>
                                <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
                                    {c.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function ShieldIcon({
    size = 24,
    className = ''
}: {
    size?: number;
    className?: string;
}) {
    return <Receipt size={size} className={className} />;
}

// ── 5. TRUST STRIP ─────────────────────────────────────────────────────

function TrustStrip() {
    const logos = ['Empresa A', 'Industrial B', 'Logística C', 'Seguridad D'];
    return (
        <section className="bg-white border-t border-zinc-100">
            <div className="max-w-6xl mx-auto px-6 py-14 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500 mb-8">
                    Empresas que confían en Uniform Logistic para vestir a su equipo
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
                    {logos.map((name) => (
                        <div
                            key={name}
                            className="text-zinc-400 font-black uppercase tracking-widest text-sm sm:text-base"
                        >
                            {name}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── 6. COMPARISON SECTION ──────────────────────────────────────────────

function ComparisonSection() {
    const traditional = [
        'Catálogo único para todos, sin personalización por empresa',
        'Cotizaciones por correo y reposiciones planificadas a mano',
        'Sin visibilidad de stock; tenés que pedir y esperar',
        'Facturación física entregada con cada despacho',
        'Soporte por WhatsApp o llamada cuando el proveedor pueda'
    ];
    const uniform = [
        'Catálogo asignado por empresa con tallas, telas y códigos CABYS propios',
        'Pedidos en línea 24/7 con seguimiento por etapas en tiempo real',
        'Bodega virtual: ves qué piezas tenés guardadas a tu nombre y dónde están',
        'Facturación electrónica firmada (Hacienda v4.4) emitida al despachar',
        'Soporte dedicado con un account manager asignado a tu empresa',
        'Notas de crédito y reportes fiscales D-104 sin trámites manuales'
    ];

    return (
        <section className="bg-white">
            <div className="max-w-6xl mx-auto px-6 py-20">
                <h2 className="text-center text-3xl sm:text-4xl font-black tracking-tight mb-12">
                    ¿En qué se diferencia Uniform Logistic de un proveedor tradicional?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <CompareCard
                        title="Proveedor tradicional"
                        items={traditional}
                        tone="muted"
                    />
                    <CompareCard
                        title="Uniform Logistic"
                        items={uniform}
                        tone="accent"
                    />
                </div>
            </div>
        </section>
    );
}

function CompareCard({
    title,
    items,
    tone
}: {
    title: string;
    items: string[];
    tone: 'muted' | 'accent';
}) {
    const cls =
        tone === 'accent'
            ? 'bg-orange-900 text-orange-50 border-orange-900 shadow-2xl shadow-orange-900/30'
            : 'bg-zinc-50 text-zinc-700 border-zinc-200';
    const bullet =
        tone === 'accent'
            ? 'text-orange-300'
            : 'text-zinc-400';
    return (
        <div className={`rounded-2xl border p-7 ${cls}`}>
            <h3 className="text-xl font-extrabold mb-5 flex items-center gap-2">
                {tone === 'accent' && (
                    <span className="w-7 h-7 rounded-md bg-orange-700/60 grid place-items-center text-[10px] font-black">
                        UL
                    </span>
                )}
                {title}
            </h3>
            <ul className="space-y-3">
                {items.map((i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                        <Check size={16} className={`shrink-0 mt-0.5 ${bullet}`} />
                        <span>{i}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ── 7. TESTIMONIAL ─────────────────────────────────────────────────────

function TestimonialSection() {
    return (
        <section className="bg-orange-900 text-white">
            <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-orange-950/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/employee-team.jpg"
                        alt="Equipo de trabajo uniformado en planta"
                        className="w-full h-full object-cover opacity-90"
                    />
                </div>
                <div>
                    <p className="text-2xl sm:text-3xl font-extrabold leading-snug">
                        “Uniform Logistic redujo en 60% el tiempo entre que pedimos los
                        uniformes y los entregamos al personal nuevo. Y la facturación
                        ya nos llega lista para Hacienda.”
                    </p>
                    <p className="mt-6 text-sm font-black uppercase tracking-widest text-orange-200">
                        — Gerencia de Operaciones, Empresa Cliente
                    </p>
                </div>
            </div>
        </section>
    );
}

// ── 8. GET STARTED ─────────────────────────────────────────────────────

function GetStartedSection() {
    return (
        <section className="bg-white">
            <div className="max-w-6xl mx-auto px-6 py-20">
                <h2 className="text-center text-3xl sm:text-4xl font-black tracking-tight">
                    Empezá con Uniform Logistic
                </h2>
                <p className="text-center mt-3 text-zinc-600 max-w-xl mx-auto">
                    Escogé la modalidad que mejor se ajuste al tamaño y madurez de tu
                    operación. Cambiar de plan es inmediato.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                    <ActionCard
                        title="Hacé tu primer pedido"
                        bullets={[
                            'Registrate y configurá tu cuenta en minutos',
                            'Asignamos un catálogo base con tallas estándar',
                            'Realizá tu primer pedido en línea',
                            'Recibí facturación electrónica al despachar',
                            'Acceso al dashboard y reportes básicos'
                        ]}
                        cta="Registrarse"
                        ctaHref="/login"
                    />
                    <ActionCard
                        title="Recibí asesoría personalizada"
                        bullets={[
                            'Llamada de 30 min con un account manager',
                            'Revisamos tu rotación, tallas y prendas actuales',
                            'Diseñamos un catálogo con stock buffer dedicado',
                            'Migración asistida desde tu proveedor actual',
                            'Soporte prioritario durante 90 días'
                        ]}
                        cta="Solicitar demo"
                        ctaHref="#contacto"
                        accent
                    />
                </div>
            </div>
        </section>
    );
}

function ActionCard({
    title,
    bullets,
    cta,
    ctaHref,
    accent = false
}: {
    title: string;
    bullets: string[];
    cta: string;
    ctaHref: string;
    accent?: boolean;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white p-7 hover:shadow-lg transition-shadow flex flex-col">
            <h3 className="text-xl font-extrabold">{title}</h3>
            <ul className="mt-5 space-y-3 flex-1">
                {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-zinc-700">
                        <Check size={16} className="text-orange-600 shrink-0 mt-0.5" />
                        <span>{b}</span>
                    </li>
                ))}
            </ul>
            <Link
                href={ctaHref}
                className={`mt-6 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-sm transition-colors w-fit ${
                    accent
                        ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-md'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                }`}
            >
                {cta} <ArrowRight size={14} />
            </Link>
        </div>
    );
}

// ── 9. EMPLOYEE EXPERIENCE ─────────────────────────────────────────────

function EmployeeExperienceSection() {
    return (
        <section className="bg-orange-50">
            <div className="max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                        Mejorá la experiencia de tu personal.
                    </h2>
                    <p className="mt-5 text-base text-zinc-700 max-w-xl leading-relaxed">
                        El 72% de los empleados se siente más identificado con la
                        empresa cuando recibe su uniforme el primer día. Y el 81% nota
                        la diferencia cuando la prenda se ajusta correctamente a su
                        talla. Uniform Logistic prioriza ambas cosas.
                    </p>
                    <a
                        href="#productos"
                        className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm transition-colors"
                    >
                        Conocer más <ArrowRight size={14} />
                    </a>
                </div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-orange-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/employee-team.jpg"
                        alt="Empleados con uniforme empresarial"
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>
        </section>
    );
}

// ── 10. PRODUCTS ROW ───────────────────────────────────────────────────

function ProductsSection() {
    const items: Array<{
        eyebrow: string;
        title: string;
        desc: string;
        cta: string;
        Icon: React.ComponentType<{ size?: number; className?: string }>;
        bg: string;
    }> = [
        {
            eyebrow: 'CATÁLOGO',
            title: 'Catálogo a tu medida',
            desc: 'Asigná modelos, tallas y telas por empresa con CABYS validado y precios negociados.',
            cta: 'Conocer más',
            Icon: Layers,
            bg: 'from-rose-200 to-orange-200'
        },
        {
            eyebrow: 'STOCK BUFFER',
            title: 'Reposición programada',
            desc: 'Mantenemos un piso de stock por talla — listo para despacho cuando entra personal nuevo.',
            cta: 'Conocer más',
            Icon: PackageSearch,
            bg: 'from-amber-200 to-yellow-200'
        },
        {
            eyebrow: 'FE V4.4',
            title: 'Facturación electrónica',
            desc: 'Emitimos factura firmada, notas de crédito y reportes D-104 directo al SUREN de Hacienda.',
            cta: 'Conocer más',
            Icon: Receipt,
            bg: 'from-emerald-200 to-teal-200'
        }
    ];
    return (
        <section id="productos" className="bg-white">
            <div className="max-w-7xl mx-auto px-6 py-20">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-10">
                    Explorá los servicios de Uniform Logistic
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {items.map((it) => (
                        <div
                            key={it.title}
                            className="rounded-2xl border border-zinc-200 bg-white overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                        >
                            <div
                                className={`aspect-[5/3] bg-gradient-to-br ${it.bg} grid place-items-center`}
                            >
                                <it.Icon size={72} className="text-zinc-800/70" />
                            </div>
                            <div className="p-6 flex-1 flex flex-col">
                                <p className="text-[11px] font-black uppercase tracking-widest text-orange-700">
                                    {it.eyebrow}
                                </p>
                                <h3 className="mt-1 text-xl font-extrabold">{it.title}</h3>
                                <p className="mt-3 text-sm text-zinc-600 flex-1 leading-relaxed">
                                    {it.desc}
                                </p>
                                <a
                                    href="#contacto"
                                    className="mt-5 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs w-fit"
                                >
                                    {it.cta} <ArrowRight size={12} />
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── 11. FAQ ────────────────────────────────────────────────────────────

function FaqSection() {
    const faqs: Array<{ q: string; a: string }> = [
        {
            q: '¿Qué tipos de cuenta ofrece Uniform Logistic?',
            a: 'Manejamos dos modalidades: Plan Básico para empresas pequeñas/medianas que pidan por demanda, y Plan Pro con stock buffer dedicado, notas de crédito automatizadas y reportes fiscales. Podés cambiar de plan cuando lo necesités sin penalidad.'
        },
        {
            q: '¿Cuánto cuesta el servicio?',
            a: 'No cobramos suscripción mensual. Pagás por los uniformes que pedís a precio negociado por empresa. El Plan Pro tiene un fee anual que se acredita contra los pedidos del año.'
        },
        {
            q: '¿Cómo se factura?',
            a: 'Emitimos factura electrónica v4.4 firmada y enviada a Hacienda al momento de despachar cada pedido. Te llega por correo el PDF + el XML firmado + la respuesta de Hacienda, todo listo para tu contabilidad.'
        },
        {
            q: '¿Puedo restringir qué productos pide cada departamento?',
            a: 'Sí. Asignás un catálogo por empresa cliente y, opcionalmente, por usuario dentro de esa empresa. Cada persona solo ve y puede pedir lo que tenés autorizado para ella.'
        },
        {
            q: '¿Pueden incluir bordado o sublimado del logo?',
            a: 'Sí, ambos. Lo hacemos en planta con máquinas Tajima/Brother (ver foto en el hero). El logo se aplica como parte del proceso de producción y queda incluido en el costo por unidad.'
        },
        {
            q: '¿Aplica para uniformes médicos o de seguridad reflectivos?',
            a: 'Sí. Trabajamos las normas INTECO para reflectivos y telas antifluido para uniformes médicos. Pedinos el catálogo específico al activar tu cuenta.'
        },
        {
            q: '¿Qué pasa si una talla no le queda al empleado?',
            a: 'Podés solicitar el cambio dentro de los 7 días posteriores al despacho. Reemplazamos la prenda y emitimos automáticamente una nota de crédito por la diferencia si aplica.'
        }
    ];
    return (
        <section className="bg-orange-900 text-white">
            <div className="max-w-4xl mx-auto px-6 py-20">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-10">
                    Preguntas frecuentes
                </h2>
                <div className="divide-y divide-white/15 border-y border-white/15">
                    {faqs.map((f) => (
                        <details key={f.q} className="group py-5 cursor-pointer">
                            <summary className="flex items-center justify-between list-none">
                                <span className="font-semibold text-base sm:text-lg pr-6">
                                    {f.q}
                                </span>
                                <span className="shrink-0 w-7 h-7 rounded-full border border-white/30 grid place-items-center group-open:rotate-45 transition-transform">
                                    <Plus size={14} />
                                </span>
                            </summary>
                            <p className="mt-3 text-sm text-orange-100/85 leading-relaxed max-w-3xl">
                                {f.a}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── 12. BOTTOM CTA ─────────────────────────────────────────────────────

function BottomCTA() {
    return (
        <section id="contacto" className="bg-orange-600 text-white">
            <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                    <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-[1.05]">
                        Listo para vestir
                        <br />a tu empresa con
                        <br />
                        <span className="underline decoration-white/40">Uniform Logistic</span>?
                    </h2>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-orange-700 font-bold shadow-lg hover:bg-orange-50 transition-colors"
                        >
                            Registrarse <ArrowRight size={16} />
                        </Link>
                        <a
                            href="mailto:ventas@uniformlogistic.cr"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-white/60 text-white font-bold hover:bg-white/10 transition-colors"
                        >
                            Hablar con ventas
                        </a>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <BottomKpi
                        Icon={Truck}
                        label="Despachos"
                        value="Mismo día"
                    />
                    <BottomKpi
                        Icon={Wallet}
                        label="Crédito"
                        value="30 días"
                    />
                    <BottomKpi
                        Icon={Factory}
                        label="Etapas"
                        value="5"
                    />
                    <BottomKpi
                        Icon={ShoppingCart}
                        label="Catálogo"
                        value="Por empresa"
                    />
                </div>
            </div>
        </section>
    );
}

function BottomKpi({
    Icon,
    label,
    value
}: {
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl bg-white/10 border border-white/20 p-4 backdrop-blur">
            <Icon size={20} className="text-orange-200 mb-2" />
            <div className="text-[10px] uppercase tracking-widest font-bold text-orange-200">
                {label}
            </div>
            <div className="text-lg sm:text-xl font-extrabold mt-1">{value}</div>
        </div>
    );
}

// ── 13. FOOTER ─────────────────────────────────────────────────────────

function Footer() {
    return (
        <footer className="bg-zinc-950 text-zinc-400 text-sm">
            <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
                <div className="col-span-2">
                    <div className="flex items-center gap-2 font-semibold text-white tracking-tight">
                        <span className="w-7 h-7 rounded-md bg-gradient-to-br from-orange-500 to-orange-700 grid place-items-center text-[11px] font-black">
                            UL
                        </span>
                        <span className="text-sm uppercase tracking-widest">
                            Uniform Logistic
                        </span>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed max-w-sm">
                        Confección, almacenaje y facturación electrónica de uniformes
                        empresariales en Costa Rica.
                    </p>
                    <p className="mt-3 text-xs">
                        <Sparkles size={12} className="inline mr-1 -mt-0.5" /> Servicio activo en San José, Heredia y Alajuela.
                    </p>
                </div>

                <FooterColumn
                    title="Plataforma"
                    items={[
                        { label: 'Iniciar sesión', href: '/login' },
                        { label: 'Registrarse', href: '/login' },
                        { label: 'Servicios', href: '#productos' },
                        { label: 'Cómo funciona', href: '#funcionamiento' }
                    ]}
                />
                <FooterColumn
                    title="Empresa"
                    items={[
                        { label: 'Hablar con ventas', href: '#contacto' },
                        { label: 'Soporte', href: 'mailto:soporte@uniformlogistic.cr' },
                        { label: 'Política de devoluciones', href: '#' },
                        { label: 'Términos y privacidad', href: '#' }
                    ]}
                />
            </div>
            <div className="border-t border-zinc-900">
                <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <span>
                        © {new Date().getFullYear()} Uniform Logistic CR. Todos los
                        derechos reservados.
                    </span>
                    <span className="inline-flex items-center gap-2 text-zinc-500">
                        <FileSpreadsheet size={12} />
                        Facturación electrónica autorizada por Hacienda — Resolución v4.4
                    </span>
                </div>
            </div>
        </footer>
    );
}

function FooterColumn({
    title,
    items
}: {
    title: string;
    items: { label: string; href: string }[];
}) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-widest font-bold text-zinc-500 mb-3">
                {title}
            </div>
            <ul className="space-y-2 text-xs">
                {items.map((i) => (
                    <li key={i.label}>
                        <a href={i.href} className="hover:text-white transition-colors">
                            {i.label}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
