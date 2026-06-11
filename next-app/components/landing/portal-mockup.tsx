import { Check, Package, Bell } from 'lucide-react';

// Hand-built miniature of the real portal (no screenshot, no broken
// placeholder): an order card tracking the actual 7 production stages,
// a stock chip and a live-order toast floating around it. Floats via
// the orchestrator's [data-float] tween.
const STAGES: { label: string; done: boolean }[] = [
    { label: 'Bodega', done: true },
    { label: 'Corte', done: true },
    { label: 'Maquila', done: true },
    { label: 'Impresión', done: true },
    { label: 'Bordado', done: true },
    { label: 'Empaque', done: false },
    { label: 'Ploter', done: false }
];

export function PortalMockup() {
    const done = STAGES.filter((s) => s.done).length;

    return (
        <div className="relative mx-auto w-full max-w-sm">
            {/* Main order card */}
            <div
                data-float
                className="relative z-10 rounded-2xl border border-[#16130F]/12 bg-white shadow-[0_24px_60px_-24px_rgba(22,19,15,0.35)]"
            >
                <div className="flex items-center justify-between border-b border-[#16130F]/10 px-5 py-3.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#16130F]/50">
                        Portal · Producción
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#EA580C]">
                        ORDEN-00042
                    </span>
                </div>

                <div className="px-5 pb-5 pt-4">
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="font-sans text-lg font-extrabold leading-tight">
                                Banco Central
                            </p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#16130F]/45">
                                120 pzas · Entrega 12 jul
                            </p>
                        </div>
                        <span className="font-sans text-2xl font-extrabold text-[#EA580C]">
                            {done}/7
                        </span>
                    </div>

                    {/* Stage progress — stitched track */}
                    <div className="mt-4 flex items-center gap-1.5">
                        {STAGES.map((s) => (
                            <span
                                key={s.label}
                                className={`h-1.5 flex-1 rounded-full ${
                                    s.done ? 'bg-[#EA580C]' : 'bg-[#16130F]/10'
                                }`}
                            />
                        ))}
                    </div>

                    <ul className="mt-4 space-y-2">
                        {STAGES.slice(2, 6).map((s) => (
                            <li
                                key={s.label}
                                className="flex items-center justify-between text-[13px]"
                            >
                                <span
                                    className={
                                        s.done
                                            ? 'text-[#16130F]/75'
                                            : 'text-[#16130F]/40'
                                    }
                                >
                                    {s.label}
                                </span>
                                {s.done ? (
                                    <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-emerald-600/90 text-white">
                                        <Check size={10} strokeWidth={3.5} />
                                    </span>
                                ) : (
                                    <span className="h-4.5 w-4.5 rounded-full border border-dashed border-[#16130F]/25" />
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Stock chip */}
            <div
                data-float
                className="absolute -left-6 top-8 z-20 hidden items-center gap-2.5 rounded-2xl border border-[#16130F]/12 bg-[#F7F4EE] px-4 py-3 shadow-[0_16px_40px_-20px_rgba(22,19,15,0.4)] sm:flex"
            >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#16130F] text-[#F7F4EE]">
                    <Package size={14} />
                </span>
                <div>
                    <p className="font-sans text-sm font-extrabold leading-none">
                        1 240 pzas
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#16130F]/50">
                        Stock en bodega
                    </p>
                </div>
            </div>

            {/* Live-order toast */}
            <div
                data-float
                className="absolute -bottom-6 -right-3 z-20 flex items-center gap-2.5 rounded-2xl border border-[#16130F]/12 bg-white px-4 py-3 shadow-[0_16px_40px_-20px_rgba(22,19,15,0.4)]"
            >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#EA580C] text-white">
                    <Bell size={14} />
                </span>
                <div>
                    <p className="font-sans text-sm font-extrabold leading-none">
                        Pedido recibido
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#16130F]/50">
                        hace 12 segundos
                    </p>
                </div>
            </div>
        </div>
    );
}
