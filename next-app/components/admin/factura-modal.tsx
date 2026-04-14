'use client';

import { useState, useMemo } from 'react';
import { X, Loader2, Receipt, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import {
    emitirFacturaAction,
    type EmitirFacturaInput,
    type FacturaLineInput,
    type FacturaReceptorInput
} from '@/app/(admin)/admin/orders/factura-actions';
import type { TipoDocumento, TipoCedula, CodigoTarifa } from '@/lib/facturacion/types';

const DEFAULT_PRECIO = 0;

function buildInitialLines(order: Order): FacturaLineInput[] {
    return order.items.map((it) => ({
        codigo_cabys: it.codigoCabys || '',
        detalle: `${it.productName} — ${it.selection.size || ''}`.trim(),
        cantidad: it.quantity,
        precio_unitario: DEFAULT_PRECIO,
        unidad_medida: 'Unid',
        codigo_tarifa: '08',
        tarifa: 13
    }));
}

export function FacturaModal({ order, onClose }: { order: Order; onClose: () => void }) {
    const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('01');
    const [receptor, setReceptor] = useState<FacturaReceptorInput>({
        nombre: order.companyName || order.customerName || '',
        tipo_identificacion: '02',
        numero_identificacion: order.companyDocument || '',
        correo: order.email || '',
        telefono: order.phone || ''
    });
    const [lineas, setLineas] = useState<FacturaLineInput[]>(buildInitialLines(order));
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; text: string; detail?: string } | null>(null);

    const isFactura = tipoDocumento === '01';

    const total = useMemo(
        () =>
            lineas.reduce((sum, l) => {
                const subtotal = l.cantidad * l.precio_unitario;
                const tax = (l.tarifa || 0) / 100;
                return sum + subtotal * (1 + tax);
            }, 0),
        [lineas]
    );

    const updateLine = (idx: number, patch: Partial<FacturaLineInput>) => {
        setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    };

    const removeLine = (idx: number) => {
        setLineas((prev) => prev.filter((_, i) => i !== idx));
    };

    const addLine = () => {
        setLineas((prev) => [
            ...prev,
            {
                codigo_cabys: '',
                detalle: '',
                cantidad: 1,
                precio_unitario: 0,
                unidad_medida: 'Unid',
                codigo_tarifa: '08',
                tarifa: 13
            }
        ]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setResult(null);

        const input: EmitirFacturaInput = {
            order_id: order.uuid,
            tipo_documento: tipoDocumento,
            receptor: isFactura ? receptor : undefined,
            lineas
        };

        try {
            const res = await emitirFacturaAction(input);
            if (res.success) {
                setResult({
                    type: 'success',
                    text: 'Documento enviado a Hacienda',
                    detail: `Consecutivo: ${res.consecutivo || '—'} · Estado: ${res.estado_hacienda || 'pendiente'}`
                });
            } else {
                setResult({ type: 'error', text: 'Error al emitir', detail: res.error });
            }
        } catch (err) {
            setResult({
                type: 'error',
                text: 'Error al emitir',
                detail: err instanceof Error ? err.message : String(err)
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <Receipt className="text-orange-600" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Generar Factura Electrónica</h3>
                            <p className="text-sm text-gray-500">
                                Pedido {order.id} · {order.companyName || 'Sin empresa'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Tipo de Documento */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                                Tipo de Documento
                            </label>
                            <div className="flex gap-2">
                                <TipoButton
                                    active={tipoDocumento === '01'}
                                    onClick={() => setTipoDocumento('01')}
                                    label="Factura"
                                    sub="Requiere receptor"
                                />
                                <TipoButton
                                    active={tipoDocumento === '04'}
                                    onClick={() => setTipoDocumento('04')}
                                    label="Tiquete"
                                    sub="Sin receptor"
                                />
                            </div>
                        </div>

                        {/* Receptor (solo para Factura) */}
                        {isFactura && (
                            <div>
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                                    Receptor
                                </h4>
                                <div className="space-y-3">
                                    <Field label="Nombre / Razón Social *">
                                        <input
                                            required
                                            type="text"
                                            value={receptor.nombre}
                                            onChange={(e) => setReceptor({ ...receptor, nombre: e.target.value })}
                                            className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </Field>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Tipo Cédula *">
                                            <select
                                                required
                                                value={receptor.tipo_identificacion}
                                                onChange={(e) =>
                                                    setReceptor({
                                                        ...receptor,
                                                        tipo_identificacion: e.target.value as TipoCedula
                                                    })
                                                }
                                                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                            >
                                                <option value="01">01 — Física</option>
                                                <option value="02">02 — Jurídica</option>
                                                <option value="03">03 — DIMEX</option>
                                                <option value="04">04 — NITE</option>
                                                <option value="05">05 — Extranjero</option>
                                            </select>
                                        </Field>
                                        <Field label="Número Cédula *">
                                            <input
                                                required
                                                type="text"
                                                value={receptor.numero_identificacion}
                                                onChange={(e) =>
                                                    setReceptor({
                                                        ...receptor,
                                                        numero_identificacion: e.target.value.replace(/\D/g, '')
                                                    })
                                                }
                                                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                                            />
                                        </Field>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="Correo">
                                            <input
                                                type="email"
                                                value={receptor.correo || ''}
                                                onChange={(e) => setReceptor({ ...receptor, correo: e.target.value })}
                                                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </Field>
                                        <Field label="Teléfono">
                                            <input
                                                type="tel"
                                                value={receptor.telefono || ''}
                                                onChange={(e) => setReceptor({ ...receptor, telefono: e.target.value })}
                                                className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Líneas */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                    Detalle ({lineas.length} líneas)
                                </h4>
                                <button
                                    type="button"
                                    onClick={addLine}
                                    className="text-sm text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
                                >
                                    <Plus size={16} /> Agregar línea
                                </button>
                            </div>
                            <div className="space-y-3">
                                {lineas.map((line, idx) => (
                                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="flex items-start gap-2">
                                            <div className="flex-1 space-y-2">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <Field
                                                        label={
                                                            <span className="flex items-center gap-1">
                                                                Código CABYS *
                                                                {line.codigo_cabys.length === 13 ? (
                                                                    <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                                                        Auto
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                        Falta
                                                                    </span>
                                                                )}
                                                            </span>
                                                        }
                                                    >
                                                        <input
                                                            required
                                                            type="text"
                                                            value={line.codigo_cabys}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    codigo_cabys: e.target.value.replace(/\D/g, '')
                                                                })
                                                            }
                                                            className={`w-full p-2 border rounded text-sm font-mono outline-none focus:ring-2 focus:ring-orange-500 ${
                                                                line.codigo_cabys.length === 13
                                                                    ? 'bg-green-50/40 border-green-200'
                                                                    : 'bg-white'
                                                            }`}
                                                            placeholder="13 dígitos"
                                                            maxLength={13}
                                                        />
                                                    </Field>
                                                    <Field label="Cantidad *">
                                                        <input
                                                            required
                                                            type="number"
                                                            min="0.001"
                                                            step="0.001"
                                                            value={line.cantidad}
                                                            onChange={(e) =>
                                                                updateLine(idx, { cantidad: Number(e.target.value) })
                                                            }
                                                            className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </Field>
                                                    <Field label="Precio Unitario *">
                                                        <input
                                                            required
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={line.precio_unitario}
                                                            onChange={(e) =>
                                                                updateLine(idx, {
                                                                    precio_unitario: Number(e.target.value)
                                                                })
                                                            }
                                                            className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </Field>
                                                </div>
                                                <Field label="Detalle *">
                                                    <input
                                                        required
                                                        type="text"
                                                        value={line.detalle}
                                                        onChange={(e) => updateLine(idx, { detalle: e.target.value })}
                                                        className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                    />
                                                </Field>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <Field label="Unidad">
                                                        <input
                                                            type="text"
                                                            value={line.unidad_medida || 'Unid'}
                                                            onChange={(e) =>
                                                                updateLine(idx, { unidad_medida: e.target.value })
                                                            }
                                                            className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        />
                                                    </Field>
                                                    <Field label="Tarifa IVA">
                                                        <select
                                                            value={line.codigo_tarifa || '08'}
                                                            onChange={(e) => {
                                                                const codigo = e.target.value as CodigoTarifa;
                                                                const tarifaMap: Record<CodigoTarifa, number> = {
                                                                    '01': 0,
                                                                    '02': 1,
                                                                    '03': 2,
                                                                    '04': 4,
                                                                    '05': 0,
                                                                    '06': 4,
                                                                    '07': 8,
                                                                    '08': 13
                                                                };
                                                                updateLine(idx, {
                                                                    codigo_tarifa: codigo,
                                                                    tarifa: tarifaMap[codigo]
                                                                });
                                                            }}
                                                            className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                        >
                                                            <option value="01">01 — 0% Exento</option>
                                                            <option value="02">02 — 1% Red.</option>
                                                            <option value="03">03 — 2% Red.</option>
                                                            <option value="04">04 — 4% Red.</option>
                                                            <option value="05">05 — 0% Transit.</option>
                                                            <option value="06">06 — 4% Transit.</option>
                                                            <option value="07">07 — 8% Transit.</option>
                                                            <option value="08">08 — 13% General</option>
                                                        </select>
                                                    </Field>
                                                    <div className="flex items-end">
                                                        <div className="w-full text-right text-sm font-mono font-semibold text-gray-800 p-2">
                                                            ₡
                                                            {(
                                                                line.cantidad *
                                                                line.precio_unitario *
                                                                (1 + (line.tarifa || 0) / 100)
                                                            ).toLocaleString('es-CR', {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeLine(idx)}
                                                disabled={lineas.length === 1}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Eliminar línea"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 flex justify-end">
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">Total estimado</div>
                                    <div className="text-2xl font-bold text-gray-900 font-mono">
                                        ₡
                                        {total.toLocaleString('es-CR', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Resultado */}
                        {result && (
                            <div
                                className={`p-4 rounded-lg border ${
                                    result.type === 'success'
                                        ? 'bg-green-50 border-green-200 text-green-800'
                                        : 'bg-red-50 border-red-200 text-red-800'
                                }`}
                            >
                                <div className="flex items-start gap-2">
                                    {result.type === 'success' ? (
                                        <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertCircle size={20} className="shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <div className="font-bold">{result.text}</div>
                                        {result.detail && (
                                            <div className="text-sm mt-1 font-mono">{result.detail}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 p-6 border-t border-gray-100 bg-gray-50">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-white"
                        >
                            {result?.type === 'success' ? 'Cerrar' : 'Cancelar'}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || result?.type === 'success'}
                            className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 disabled:bg-gray-300 flex items-center justify-center gap-2 shadow-md"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Receipt size={18} />}
                            {submitting ? 'Enviando a Hacienda...' : 'Emitir documento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function TipoButton({
    active,
    onClick,
    label,
    sub
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    sub: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex-1 p-3 rounded-lg border text-left transition-colors ${
                active
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
            }`}
        >
            <div className="font-bold">{label}</div>
            <div className={`text-xs ${active ? 'text-orange-100' : 'text-gray-500'}`}>{sub}</div>
        </button>
    );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
            {children}
        </div>
    );
}
