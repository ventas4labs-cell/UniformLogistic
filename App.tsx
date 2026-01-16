import React, { useState, useEffect } from 'react';
import { ShoppingCart, User, Package, Calendar, Clock, Check, X, ArrowLeft, Trash2, Globe, Ruler, Sparkles, Loader2, RefreshCw, Home, LogOut, Download, History, Plus, RotateCw, Menu, Camera, Wand2 } from 'lucide-react';
import { PRODUCTS } from './constants';
import { AppView, CartItem, Product, Order, SizeSelection } from './types';
import SizeSelector from './components/SizeSelector';
import Cart from './components/Cart';
import AICounter from './components/AICounter';
import ImageGen from './components/ImageGen';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import { supabase } from './services/supabase';
import { generateCustomerPDF, generateAdminPDF } from './services/pdfService';

function App() {
    const [session, setSession] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [view, setView] = useState<AppView>(AppView.LOGIN);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [lastOrder, setLastOrder] = useState<Order | null>(null);
    const [orderHistory, setOrderHistory] = useState<Order[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<'All' | 'Men' | 'Women'>('All');

    // Form State
    const [customerForm, setCustomerForm] = useState({
        name: '', company: '', email: '', phone: '', notes: '', date: ''
    });

    const addBusinessDays = (startDate: Date, days: number) => {
        let currentDate = new Date(startDate);
        let addedDays = 0;
        while (addedDays < days) {
            currentDate.setDate(currentDate.getDate() + 1);
            if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                addedDays++;
            }
        }
        return currentDate;
    };

    const deliveryDate = addBusinessDays(new Date(), 30).toISOString().split('T')[0];

    // Auth State Listener
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                const { full_name, company_name, phone } = session.user.user_metadata || {};
                setCustomerForm(prev => ({
                    ...prev,
                    name: full_name || '',
                    company: company_name || '',
                    email: session.user.email || '',
                    phone: phone || '',
                    date: deliveryDate
                }));

                setIsAdmin(session.user.email === 'Ulogisticcr@gmail.com' || session.user.email === 'ulogisticcr@gmail.com');
                setView(AppView.LANDING);
                // Fetch history when session is active
                // We need to define fetchOrderHistory outside or use a separate effect
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                const { full_name, company_name, phone } = session.user.user_metadata || {};
                setCustomerForm(prev => ({
                    ...prev,
                    name: full_name || '',
                    company: company_name || '',
                    email: session.user.email || '',
                    phone: phone || '',
                    date: deliveryDate
                }));

                setIsAdmin(session.user.email === 'Ulogisticcr@gmail.com' || session.user.email === 'ulogisticcr@gmail.com');
                setView(AppView.LANDING);
            } else {
                setCustomerForm({ name: '', company: '', email: '', phone: '', notes: '', date: '' });
                setIsAdmin(false);
                setView(AppView.LOGIN);
                setOrderHistory([]); // Clear history on logout
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch history whenever session changes
    useEffect(() => {
        if (session?.user?.id) {
            fetchOrderHistory();
        }
    }, [session]);

    // Moved fetchOrderHistory to be accessible
    const fetchOrderHistory = async () => {
        if (!session?.user?.id) return;

        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mappedOrders: Order[] = (data || []).map(d => ({
                id: d.order_ref || `ORDEN-${String(d.order_number || 0).padStart(5, '0')}`,
                customerName: d.customer_name,
                companyName: d.company_name,
                email: d.email,
                phone: d.phone,
                deliveryDate: new Date(new Date(d.created_at).setDate(new Date(d.created_at).getDate() + 45)).toISOString(), // approx
                notes: '',
                items: d.items,
                dateCreated: d.created_at
            }));

            setOrderHistory(mappedOrders);
        } catch (e) {
            console.error('Error fetching history:', e);
        }
    };

    // Navigation Handlers
    const goBack = () => {
        if (view === AppView.PRODUCT_DETAIL) setView(AppView.CATALOG);
        else if (view === AppView.CART) setView(AppView.CATALOG);
        else if (view === AppView.CHECKOUT) setView(AppView.CART);
        else if (view === AppView.ORDER_HISTORY) setView(AppView.LANDING);
        else setView(AppView.LANDING);
    };

    // Cart Logic
    // Updated to support adding multiple items (bulk)
    const addToCart = (items: { selection: SizeSelection; quantity: number }[]) => {
        if (!activeProduct) return;

        const newItems = items.map(item => ({
            productId: activeProduct.id,
            productName: activeProduct.name,
            selection: item.selection,
            quantity: item.quantity
        }));

        setCart(prev => [...prev, ...newItems]);
        setActiveProduct(null);
        setView(AppView.CATALOG);
    };

    const removeFromCart = (index: number) => {
        const newCart = [...cart];
        newCart.splice(index, 1);
        setCart(newCart);
    };

    const handleReorder = (order: Order, append: boolean) => {
        const itemsToAdd = order.items.map(i => ({ ...i })); // Deep copy items
        if (append) {
            setCart(prev => [...prev, ...itemsToAdd]);
        } else {
            setCart(itemsToAdd);
        }
        setView(AppView.CART);
    };

    // Checkout Logic
    const handleCheckoutSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const newOrder: Order = {
            id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            customerName: customerForm.name,
            companyName: customerForm.company,
            email: customerForm.email,
            phone: customerForm.phone,
            deliveryDate: customerForm.date,
            notes: customerForm.notes,
            items: cart,
            dateCreated: new Date().toISOString()
        };

        setLastOrder(newOrder);
        setOrderHistory(prev => [newOrder, ...prev]);
        setCart([]);
        setView(AppView.SUCCESS);

        // Insert into Supabase
        const { data, error } = await supabase.from('orders').insert({
            // order_ref: newOrder.id, // Removed to let order_number decide
            user_id: session?.user?.id, // Link to auth user
            customer_name: newOrder.customerName,
            company_name: newOrder.companyName,
            email: newOrder.email,
            phone: newOrder.phone,
            items: newOrder.items,
            status: 'new'
        }).select('order_number').single();

        if (error) {
            console.error("DB Save Error", error);
        } else {
            // Refresh history from DB
            fetchOrderHistory();

            // Update the current order ID with the real consecutive number
            const realId = `ORDEN-${String(data.order_number).padStart(5, '0')}`;
            newOrder.id = realId;

            setLastOrder({ ...newOrder });

            // Auto-generate PDF with real ID
            // const pdf = generateCustomerPDF(newOrder);
            // pdf.save(`UniformOrder_${realId}.pdf`);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setView(AppView.LOGIN);
    };

    // --- Views ---

    const renderLanding = () => (
        <div className="flex flex-col min-h-screen hero-gradient text-white relative overflow-hidden font-sans selection:bg-orange-500 selection:text-white">
            {/* Background Decor - Animated Orbs */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-20%] w-[600px] h-[600px] bg-orange-600/30 rounded-full blur-[120px]"></div>

            {/* Header / Logout */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={handleLogout}
                    className="group bg-white/10 backdrop-blur-md p-3 pr-4 rounded-full hover:bg-white/20 transition-all text-white border border-white/10 shadow-lg flex items-center gap-2"
                    title="Cerrar Sesión"
                >
                    <div className="bg-white/20 p-1.5 rounded-full group-hover:bg-white/30 transition-colors">
                        <LogOut size={16} />
                    </div>
                    <span className="text-sm font-medium opacity-90">Salir</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 animate-fade-in w-full max-w-5xl mx-auto">

                {/* Logo Section - Glass Card effect for logo */}
                <div className="relative mb-8 group">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full transform group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="relative bg-white/90 backdrop-blur-sm p-8 rounded-[2.5rem] shadow-2xl w-52 h-52 flex items-center justify-center transform hover:scale-105 transition-all duration-300 border border-white/50">
                        <img src="/logo.png" alt="Uniform Logistic Logo" className="w-full h-auto object-contain drop-shadow-md" />
                    </div>
                </div>

                {/* Typography */}
                <div className="space-y-4 mb-12">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-none drop-shadow-sm">
                        Uniform <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-100 to-orange-50">Logistic</span>
                    </h1>
                    <p className="text-orange-100 text-lg md:text-2xl font-light max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
                        Gestión inteligente de uniformes para profesionales de seguridad.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="w-full max-w-md space-y-4 flex flex-col items-center">
                    <button
                        onClick={() => setView(AppView.CATALOG)}
                        className="group relative w-full py-5 px-8 bg-white text-orange-600 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-orange-900/20 transition-all hover:-translate-y-1 active:scale-95 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-50 to-white opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="relative flex items-center justify-center gap-3">
                            Start New Order
                            <ArrowLeft className="rotate-180 group-hover:translate-x-1 transition-transform" size={24} />
                        </span>
                    </button>

                    <button
                        onClick={() => setView(AppView.ORDER_HISTORY)}
                        className="w-full py-4 px-8 bg-black/20 backdrop-blur-md text-white rounded-2xl font-semibold border border-white/10 hover:bg-black/30 hover:border-white/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                        <History size={20} className="text-orange-200" />
                        <span>Order History</span>
                    </button>

                    {/* Admin Actions Area */}
                    {(isAdmin) && (
                        <div className="grid grid-cols-2 gap-3 w-full pt-4 border-t border-white/10 mt-2">
                            <button
                                onClick={() => setView(AppView.AI_COUNT)}
                                className="bg-white/5 backdrop-blur-sm text-white py-3 px-4 rounded-xl text-sm font-medium border border-white/5 hover:bg-white/10 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2"
                            >
                                <Camera size={20} className="text-orange-300" />
                                <span>AI Counter</span>
                            </button>
                            <button
                                onClick={() => setView(AppView.ADMIN_DASHBOARD)}
                                className="bg-white/5 backdrop-blur-sm text-white py-3 px-4 rounded-xl text-sm font-medium border border-white/5 hover:bg-white/10 hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2"
                            >
                                <Plus size={20} className="text-orange-300" />
                                <span>Dashboard</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 text-center">
                <p className="text-orange-200/60 text-xs font-medium tracking-widest uppercase">
                    v1.2.0 • Premium Enterprise Solution
                </p>
            </div>
        </div>
    );

    const renderCatalog = () => (
        <div className="pb-24 max-w-6xl mx-auto">
            {/* Category Tabs */}
            <div className="px-4 pt-4 pb-6 sticky top-16 bg-gray-50/80 backdrop-blur-md z-20">
                <div className="flex p-1.5 bg-gray-200/50 rounded-2xl shadow-inner border border-white/50 max-w-md mx-auto">
                    {(['All', 'Men', 'Women'] as const).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${categoryFilter === cat
                                ? 'bg-white text-orange-600 shadow-md ring-1 ring-black/5'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-white/30'
                                }`}
                        >
                            {cat === 'All' ? 'Todos' : cat === 'Men' ? 'Caballeros' : 'Damas'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-8">
                {PRODUCTS.filter(p => categoryFilter === 'All' || p.category === categoryFilter).map(product => {
                    const qtyInCart = cart.filter(c => c.productId === product.id).reduce((sum, i) => sum + i.quantity, 0);
                    return (
                        <div key={product.id} className="premium-card overflow-hidden flex flex-col group animate-fade-in">
                            <div className="aspect-[4/5] overflow-hidden bg-gray-100 relative">
                                <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                {qtyInCart > 0 && (
                                    <div className="absolute top-4 right-4 bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white animate-bounce">
                                        {qtyInCart} en carrito
                                    </div>
                                )}
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{product.name}</h3>
                                <p className="text-gray-500 text-xs mb-6 line-clamp-2 font-medium">{product.description}</p>
                                <button
                                    onClick={() => { setActiveProduct(product); }}
                                    className="mt-auto w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-orange-600 transition-all shadow-lg active:scale-95"
                                >
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderOrderHistory = () => (
        <div className="p-4 pb-24">
            <h2 className="text-2xl font-bold mb-6">Historial de Pedidos</h2>
            {orderHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    <History size={48} className="mx-auto mb-4 opacity-30" />
                    <p>No hay pedidos anteriores.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orderHistory.map(order => (
                        <div key={order.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-gray-900">{order.id}</h3>
                                    <p className="text-xs text-gray-500">{new Date(order.dateCreated).toLocaleDateString()}</p>
                                </div>
                                <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">
                                    {order.items.length} artículos
                                </span>
                            </div>
                            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                                <button
                                    className="flex-1 py-2 text-center text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    onClick={() => generateCustomerPDF(order).save(`Pedido_${order.id}.pdf`)}
                                >
                                    <Download size={16} /> Descargar Comprobante
                                </button>
                                <button className="flex-1 py-2 text-center text-sm font-bold text-gray-500 bg-gray-100 rounded-lg cursor-not-allowed">
                                    Rastrear
                                </button>
                            </div>
                            <p className="text-sm text-gray-700 mb-4">
                                Cliente: {order.customerName} ({order.companyName})
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleReorder(order, true)}
                                    className="flex-1 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 hover:bg-gray-50"
                                >
                                    <Plus size={14} /> Añadir al Carrito
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('¿Vaciar carrito actual y comenzar con este pedido?')) {
                                            handleReorder(order, false);
                                        }
                                    }}
                                    className="flex-1 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 hover:bg-orange-100"
                                >
                                    <RotateCw size={14} /> Repetir Pedido
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderCheckout = () => (
        <div className="p-4 pb-24 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">Detalles del Pedido</h2>
            <form onSubmit={handleCheckoutSubmit} className="space-y-4 shadow-sm bg-white p-6 rounded-2xl border border-gray-100">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 mb-6">
                    <p className="text-sm text-gray-600 mb-1">Solicitante: <span className="font-bold text-gray-900">{customerForm.name}</span></p>
                    <p className="text-sm text-gray-600 mb-1">Empresa: <span className="font-bold text-gray-900">{customerForm.company}</span></p>
                    <p className="text-xs text-gray-500">{customerForm.email} • {customerForm.phone}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Entrega (Estimada: 30 Días Hábiles)</label>
                    <input required type="date" className="w-full p-3 border rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
                        readOnly
                        value={customerForm.date} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea className="w-full p-3 border rounded-xl h-24"
                        value={customerForm.notes} onChange={e => setCustomerForm({ ...customerForm, notes: e.target.value })} />
                </div>

                <button type="submit" className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg mt-8 hover:bg-orange-700 transition-colors">
                    Confirmar Pedido
                </button>
            </form>
        </div>
    );

    const renderSuccess = () => (
        <div className="h-screen flex flex-col items-center justify-center p-8 text-center bg-gray-50">
            <div className="bg-green-100 p-6 rounded-full mb-6 text-green-600">
                <Check size={48} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Pedido Confirmado!</h2>
            <p className="text-gray-600 mb-8">Ref: {lastOrder?.id}</p>

            <div className="space-y-4 w-full max-w-sm">
                <button
                    onClick={() => {
                        if (lastOrder) {
                            generateCustomerPDF(lastOrder).save(`UniformOrder_${lastOrder.id}.pdf`);
                        }
                    }}
                    className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold shadow-md hover:bg-orange-700 transition-colors"
                >
                    Descargar Comprobante PDF
                </button>
                <button
                    onClick={() => setView(AppView.LANDING)}
                    className="w-full py-3 border border-gray-300 text-gray-600 rounded-xl font-semibold"
                >
                    Volver al Inicio
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">

            {/* Top Navigation */}
            {view !== AppView.LANDING && view !== AppView.SUCCESS && view !== AppView.AI_COUNT && view !== AppView.AI_GENERATE && (
                <header className="sticky top-0 z-40 glass-header px-6 py-4">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {view !== AppView.CATALOG && (
                                <button onClick={goBack} className="p-2.5 bg-gray-100 rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-all active:scale-90">
                                    <ArrowLeft size={20} />
                                </button>
                            )}
                            <h1 className="font-extrabold text-2xl tracking-tight text-gray-900">
                                {view === AppView.CATALOG && 'Catálogo'}
                                {view === AppView.CART && 'Carrito'}
                                {view === AppView.CHECKOUT && 'Finalizar'}
                                {view === AppView.ORDER_HISTORY && 'Historial'}
                            </h1>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setView(AppView.LANDING)}
                                className="p-2.5 bg-gray-100 rounded-xl text-gray-600 hover:bg-orange-50 hover:text-orange-600 transition-all active:scale-90"
                                title="Inicio"
                            >
                                <Home size={20} />
                            </button>
                            <button
                                onClick={() => setView(AppView.CART)}
                                className="relative p-2.5 bg-gray-900 rounded-xl text-white hover:bg-orange-600 transition-all shadow-lg active:scale-95 group"
                            >
                                <ShoppingCart size={20} />
                                {cart.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center ring-4 ring-white group-hover:scale-110 transition-transform">
                                        {cart.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* Main Content */}
            <main className="mx-auto w-full max-w-7xl px-4 lg:px-8 py-6">
                {view === AppView.LOGIN && <Login onSuccess={() => setView(AppView.LANDING)} />}
                {view === AppView.ADMIN_DASHBOARD && isAdmin && (
                    <AdminDashboard
                        onLogout={handleLogout}
                        onBack={() => setView(AppView.LANDING)}
                        onNewOrder={() => setView(AppView.CATALOG)}
                    />
                )}

                {!session && view !== AppView.LOGIN ? (
                    <div className="flex h-screen items-center justify-center">Cargando...</div>
                ) : (
                    <>
                        {view === AppView.LANDING && renderLanding()}
                        {view === AppView.CATALOG && renderCatalog()}
                        {view === AppView.CART && (
                            <div className="max-w-4xl mx-auto">
                                <Cart
                                    cart={cart}
                                    onRemove={removeFromCart}
                                    onCheckout={() => setView(AppView.CHECKOUT)}
                                    onContinueShopping={() => setView(AppView.CATALOG)}
                                />
                            </div>
                        )}
                        {view === AppView.CHECKOUT && renderCheckout()}
                        {view === AppView.SUCCESS && renderSuccess()}
                        {view === AppView.ORDER_HISTORY && renderOrderHistory()}

                        {/* Modals/Overlays */}
                        {activeProduct && (
                            <SizeSelector
                                product={activeProduct}
                                onAdd={addToCart}
                                onCancel={() => setActiveProduct(null)}
                            />
                        )}

                        {view === AppView.AI_COUNT && (
                            <AICounter onClose={() => setView(AppView.LANDING)} />
                        )}

                        {view === AppView.AI_GENERATE && (
                            <ImageGen onClose={() => setView(AppView.LANDING)} />
                        )}
                    </>
                )}
            </main>

        </div>
    );
}

export default App;