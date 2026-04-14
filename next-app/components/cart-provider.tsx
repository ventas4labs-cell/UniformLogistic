'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { CartItem, SizeSelection } from '@/lib/types';

const STORAGE_KEY = 'ul-cart-v1';

interface CartCtx {
    cart: CartItem[];
    totalItems: number;
    addItems: (
        productId: string,
        productName: string,
        items: { selection: SizeSelection; quantity: number }[]
    ) => void;
    removeAt: (index: number) => void;
    setQuantity: (index: number, quantity: number) => void;
    replace: (items: CartItem[]) => void;
    clear: () => void;
}

const CartContext = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [hydrated, setHydrated] = useState(false);

    // Hydrate from localStorage once on mount
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) setCart(parsed);
            }
        } catch {
            // ignore corrupt storage
        } finally {
            setHydrated(true);
        }
    }, []);

    // Persist
    useEffect(() => {
        if (!hydrated) return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        } catch {
            // ignore (private mode, quota)
        }
    }, [cart, hydrated]);

    const addItems = useCallback(
        (
            productId: string,
            productName: string,
            items: { selection: SizeSelection; quantity: number }[]
        ) => {
            const rows: CartItem[] = items.map((i) => ({
                productId,
                productName,
                selection: i.selection,
                quantity: i.quantity,
            }));
            setCart((prev) => [...prev, ...rows]);
        },
        []
    );

    const removeAt = useCallback((index: number) => {
        setCart((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const setQuantity = useCallback((index: number, quantity: number) => {
        setCart((prev) => {
            if (quantity <= 0) return prev.filter((_, i) => i !== index);
            return prev.map((it, i) => (i === index ? { ...it, quantity } : it));
        });
    }, []);

    const replace = useCallback((items: CartItem[]) => {
        setCart(items);
    }, []);

    const clear = useCallback(() => setCart([]), []);

    const totalItems = useMemo(
        () => cart.reduce((acc, i) => acc + i.quantity, 0),
        [cart]
    );

    const value = useMemo(
        () => ({ cart, totalItems, addItems, removeAt, setQuantity, replace, clear }),
        [cart, totalItems, addItems, removeAt, setQuantity, replace, clear]
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used within CartProvider');
    return ctx;
}
