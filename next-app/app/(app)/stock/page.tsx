import { Boxes, Layers, Package, Wallet } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchStockForUser, summarizeStock, type StockRow } from '@/lib/services/stock';

const fmtCRC = (n: number) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

export default async function StockPage() {
    const supabase = await createClient();
    const {
        data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    const rows = await fetchStockForUser(supabase, user.id);
    const summary = summarizeStock(rows);

    // Group rows by product for the cards-then-table layout
    const byProduct = new Map<string, StockRow[]>();
    rows.forEach((r) => {
        const arr = byProduct.get(r.productId) || [];
        arr.push(r);
        byProduct.set(r.productId, arr);
    });

    return (
        <div className="space-y-8">
            <header>
                <p className="text-xs uppercase tracking-widest font-semibold text-orange-600">
                    Inventario
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 mt-1">
                    Stock disponible
                </h1>
                <p className="text-zinc-500 text-sm mt-1">
                    Uniformes guardados en bodega de Uniform Logistic a tu nombre.
                </p>
            </header>

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi
                    label="Productos distintos"
                    value={summary.byProduct.size}
                    sub={`${summary.skuCount} variantes (talla)`}
                    Icon={Package}
                    accent="orange"
                />
                <Kpi
                    label="Piezas en bodega"
                    value={summary.totalOnHand.toLocaleString('es-CR')}
                    sub={`${summary.totalAvailable.toLocaleString('es-CR')} disponibles`}
                    Icon={Boxes}
                    accent="blue"
                />
                <Kpi
                    label="Reservadas"
                    value={(summary.totalOnHand - summary.totalAvailable).toLocaleString('es-CR')}
                    sub="comprometidas en pedidos"
                    Icon={Layers}
                    accent="purple"
                />
                <Kpi
                    label="Valor estimado"
                    value={fmtCRC(summary.estimatedValue)}
                    sub="al precio actual"
                    Icon={Wallet}
                    accent="emerald"
                />
            </section>

            {rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500">
                    <Boxes size={36} className="mx-auto mb-3 opacity-30" />
                    No tienes inventario en bodega todavía. Cuando recibas tu primer pedido,
                    aparecerá aquí.
                </div>
            ) : (
                <div className="space-y-6">
                    {Array.from(summary.byProduct.values())
                        .sort((a, b) => a.productName.localeCompare(b.productName))
                        .map((p) => {
                            const sizes = (byProduct.get(p.productId) || []).slice().sort((a, b) =>
                                a.size.localeCompare(b.size, undefined, { numeric: true })
                            );
                            return (
                                <ProductBlock key={p.productId} product={p} rows={sizes} />
                            );
                        })}
                </div>
            )}
        </div>
    );
}

function ProductBlock({
    product,
    rows
}: {
    product: {
        productCode: string;
        productName: string;
        productType: 'shirt' | 'pant';
        imageUrl: string | null;
        unitPrice: number | null;
        totalOnHand: number;
        totalAvailable: number;
        sizeCount: number;
    };
    rows: StockRow[];
}) {
    return (
        <section className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white">
                {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={product.imageUrl}
                        alt=""
                        className="w-16 h-16 object-cover rounded-xl border border-zinc-200 bg-white shrink-0"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-300 shrink-0">
                        <Package size={20} />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-zinc-900 truncate">{product.productName}</h2>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs">
                        <span
                            className={`font-bold px-2 py-0.5 rounded-full ${product.productType === 'shirt' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}
                        >
                            {product.productType === 'shirt' ? 'Camisa' : 'Pantalón'}
                        </span>
                        <span className="text-zinc-500 font-mono">{product.productCode}</span>
                        {product.unitPrice && (
                            <span className="text-zinc-700 font-semibold">
                                {fmtCRC(product.unitPrice)} / pieza
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
                        En bodega
                    </div>
                    <div className="text-2xl font-extrabold text-zinc-900">
                        {product.totalOnHand}
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold">
                        {product.totalAvailable} disponibles
                    </div>
                </div>
            </div>
            <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr className="text-left">
                        <th className="px-4 py-2 font-semibold text-zinc-600">Talla</th>
                        <th className="px-4 py-2 font-semibold text-zinc-600 text-right">En bodega</th>
                        <th className="px-4 py-2 font-semibold text-zinc-600 text-right">Reservadas</th>
                        <th className="px-4 py-2 font-semibold text-zinc-600 text-right">Disponibles</th>
                        <th className="px-4 py-2 font-semibold text-zinc-600 text-right">Valor</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                    {rows.map((r) => {
                        const lowStock = r.quantityAvailable <= 3;
                        return (
                            <tr key={r.id} className="hover:bg-zinc-50">
                                <td className="px-4 py-2 font-mono font-semibold text-zinc-800">
                                    {r.size}
                                </td>
                                <td className="px-4 py-2 text-right">{r.quantityOnHand}</td>
                                <td className="px-4 py-2 text-right text-zinc-500">
                                    {r.quantityReserved || '—'}
                                </td>
                                <td
                                    className={`px-4 py-2 text-right font-bold ${lowStock ? 'text-amber-600' : 'text-emerald-700'}`}
                                >
                                    {r.quantityAvailable}
                                    {lowStock && (
                                        <span className="ml-1 text-[10px] uppercase tracking-wider">
                                            bajo
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2 text-right text-zinc-600">
                                    {r.unitPrice ? fmtCRC(r.unitPrice * r.quantityOnHand) : '—'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </section>
    );
}

function Kpi({
    label,
    value,
    sub,
    Icon,
    accent
}: {
    label: string;
    value: string | number;
    sub: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    accent: 'orange' | 'blue' | 'purple' | 'emerald';
}) {
    const ring =
        accent === 'orange'
            ? 'bg-orange-50 text-orange-700'
            : accent === 'blue'
              ? 'bg-blue-50 text-blue-700'
              : accent === 'purple'
                ? 'bg-purple-50 text-purple-700'
                : 'bg-emerald-50 text-emerald-700';
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ring}`}>
                <Icon size={18} />
            </div>
            <div className="min-w-0">
                <div className="text-xs text-zinc-500 font-medium truncate">{label}</div>
                <div className="text-xl font-extrabold text-zinc-900 leading-none mt-0.5 truncate">
                    {value}
                </div>
                <div className="text-[11px] text-zinc-500 truncate">{sub}</div>
            </div>
        </div>
    );
}
