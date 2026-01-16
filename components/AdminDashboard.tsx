import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { AppView, Order } from '../types';
import { generateAdminPDF } from '../services/pdfService';
import { Download, Search, LogOut, RefreshCw } from 'lucide-react';

interface AdminDashboardProps {
    onLogout: () => void;
    onBack: () => void;
    onNewOrder: () => void;
}

const ORDER_STATUSES = [
    { value: 'new', label: 'Pendiente', color: 'bg-blue-100 text-blue-800' },
    { value: 'in_progress', label: 'En Proceso', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'completed', label: 'Completado', color: 'bg-green-100 text-green-800' },
    { value: 'delivered', label: 'Entregado', color: 'bg-gray-100 text-gray-800' }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onBack, onNewOrder }) => {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleDownloadPdf = (orderData: any) => {
        const orderId = orderData.order_ref || `ORDEN-${String(orderData.order_number || 0).padStart(5, '0')}`;
        // Reconstruct Order object structure if needed
        const order: Order = {
            id: orderId,
            customerName: orderData.customer_name,
            companyName: orderData.company_name,
            email: orderData.email,
            phone: orderData.phone,
            deliveryDate: new Date(orderData.created_at).toLocaleDateString(),
            notes: '',
            items: orderData.items,
            dateCreated: orderData.created_at
        };

        const pdf = generateAdminPDF(order);
        pdf.save(`ADMIN_${orderId}.pdf`);
    };

    const updateStatus = async (orderId: string, newStatus: string) => {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId); // using 'id' might be wrong if we use internal UUID, let's check fetchOrders

        // Wait, fetchOrders uses check 'order_ref' or 'id'. 
        // Supabase 'id' is distinct from 'order_ref'. 
        // We need to know which ID to use. 
        // The table renders key={order.id}, so order.id is likely the UUID from Supabase.

        if (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar estado');
        } else {
            // Optimistic update
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        }
    };

    const filteredOrders = orders.filter(o =>
        o.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.order_ref?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
                        <p className="text-gray-500">Logística y Control de Producción</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onNewOrder}
                            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 shadow-md flex items-center gap-2"
                        >
                            + Nuevo Pedido
                        </button>
                        <button onClick={onBack} className="text-gray-600 hover:text-gray-900">Volver a la App</button>
                        <button onClick={onLogout} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 flex items-center gap-2">
                            <LogOut size={18} /> Cerrar Sesión
                        </button>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex justify-between items-center">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar pedidos..."
                            className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={fetchOrders} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        <RefreshCw size={20} />
                    </button>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="p-4 font-semibold text-gray-600">Ref</th>
                                <th className="p-4 font-semibold text-gray-600">Cliente</th>
                                <th className="p-4 font-semibold text-gray-600">Empresa</th>
                                <th className="p-4 font-semibold text-gray-600">Fecha</th>
                                <th className="p-4 font-semibold text-gray-600">Estado</th>
                                <th className="p-4 font-semibold text-gray-600">Artículos</th>
                                <th className="p-4 font-semibold text-gray-600 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Cargando pedidos...</td></tr>
                            ) : filteredOrders.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No se encontraron pedidos recientes.</td></tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono text-sm font-bold text-orange-600">
                                            {order.order_ref || `ORDEN-${String(order.order_number || 0).padStart(5, '0')}`}
                                        </td>
                                        <td className="p-4 font-medium text-gray-900">{order.customer_name}</td>
                                        <td className="p-4 text-gray-600">{order.company_name}</td>
                                        <td className="p-4 text-gray-500 text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                                        <td className="p-4">
                                            <select
                                                value={order.status || 'new'}
                                                onChange={(e) => updateStatus(order.id, e.target.value)}
                                                className={`py-1 px-3 rounded-full text-xs font-bold border-none outline-none cursor-pointer ${ORDER_STATUSES.find(s => s.value === (order.status || 'new'))?.color
                                                    }`}
                                            >
                                                {ORDER_STATUSES.map(status => (
                                                    <option key={status.value} value={status.value} className="bg-white text-gray-900">
                                                        {status.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full">
                                                {Array.isArray(order.items) ? order.items.reduce((s: number, i: any) => s + i.quantity, 0) : 0} pzas
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDownloadPdf(order)}
                                                className="text-orange-600 hover:text-orange-800 font-bold text-sm flex items-center justify-end gap-1 ml-auto bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 transition-colors"
                                            >
                                                <Download size={16} /> Descargar PDF
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
