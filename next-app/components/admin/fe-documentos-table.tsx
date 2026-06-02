'use client';

import { FileText } from 'lucide-react';
import type { FeDocumentoRow } from '@/lib/services/feConfig';

const TIPO_LABEL: Record<string, string> = {
    '01': 'Factura',
    '02': 'Nota Débito',
    '03': 'Nota Crédito',
    '04': 'Tiquete',
    '08': 'Factura Compra',
    '10': 'Factura Exportación'
};

const ESTADO_STYLE: Record<string, string> = {
    aceptado: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300',
    aceptado_parcial: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300',
    rechazado: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300',
    procesando: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300',
    pendiente: 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-300',
    error: 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300'
};

function formatMoney(n: number): string {
    return n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FeDocumentosTable({ documentos }: { documentos: FeDocumentoRow[] }) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-x-auto">
            <div className="p-6 border-b border-gray-100 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Documentos Emitidos</h3>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">
                    Últimos {documentos.length} documentos enviados a Hacienda.
                </p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[820px]">
                    <thead className="bg-gray-50 dark:bg-zinc-900/60 border-b border-gray-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Fecha</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Consecutivo</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Tipo</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Receptor</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400 text-right">Total</th>
                            <th className="p-4 font-semibold text-gray-600 dark:text-zinc-400">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                        {documentos.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-zinc-400">
                                    <FileText size={32} className="mx-auto mb-2 opacity-30" />
                                    Aún no hay documentos emitidos.
                                </td>
                            </tr>
                        ) : (
                            documentos.map((d) => {
                                const estadoStyle = ESTADO_STYLE[d.estado_hacienda] || 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300';
                                return (
                                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                        <td className="p-4 text-gray-500 dark:text-zinc-400 text-xs">
                                            {new Date(d.fecha_emision).toLocaleString('es-CR')}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-gray-700 dark:text-zinc-300">{d.consecutivo}</td>
                                        <td className="p-4">
                                            <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">
                                                {TIPO_LABEL[d.tipo_documento] || d.tipo_documento}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-700 dark:text-zinc-300">{d.receptor_nombre || '—'}</td>
                                        <td className="p-4 text-right font-mono font-semibold text-gray-900 dark:text-zinc-100">
                                            ₡{formatMoney(Number(d.total_comprobante) || 0)}
                                        </td>
                                        <td className="p-4">
                                            <span
                                                className={`text-xs font-bold px-2 py-1 rounded-full ${estadoStyle}`}
                                                title={d.mensaje_hacienda || ''}
                                            >
                                                {d.estado_hacienda}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
