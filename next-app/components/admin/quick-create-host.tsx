'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import {
    QUICK_CREATE_EVENT,
    type QuickCreateKind
} from '@/lib/admin-quick-create';
import {
    fetchQuickCreateDepsAction,
    type QuickCreateDeps
} from '@/app/(admin)/admin/_quick-create-actions';

// Heavy form components are code-split: their bundles only load the first
// time the admin actually opens a quick-create popup, keeping every other
// admin page lean.
const ProductsManager = dynamic(
    () => import('@/components/admin/products-manager').then((m) => m.ProductsManager),
    { ssr: false }
);
const LogosManager = dynamic(
    () => import('@/components/admin/logos-manager').then((m) => m.LogosManager),
    { ssr: false }
);
const CompaniesManager = dynamic(
    () => import('@/components/admin/companies-manager').then((m) => m.CompaniesManager),
    { ssr: false }
);
const StationUsersManager = dynamic(
    () => import('@/components/admin/station-users-manager').then((m) => m.StationUsersManager),
    { ssr: false }
);
const OrderQuickCreate = dynamic(
    () => import('@/components/admin/order-quick-create').then((m) => m.OrderQuickCreate),
    { ssr: false }
);

// Mounted once in the admin shell. Listens for QUICK_CREATE_EVENT, lazily
// fetches the form dependencies (companies, logos) once, then renders the
// matching create modal in embedded mode over the current page.
export function QuickCreateHost() {
    const [kind, setKind] = useState<QuickCreateKind | null>(null);
    const [deps, setDeps] = useState<QuickCreateDeps | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fetchingRef = useRef(false);

    useEffect(() => {
        const onOpen = (e: Event) => {
            const next = (e as CustomEvent<QuickCreateKind>).detail;
            if (
                next === 'product' ||
                next === 'logo' ||
                next === 'company' ||
                next === 'station' ||
                next === 'order'
            ) {
                setKind(next);
            }
        };
        window.addEventListener(QUICK_CREATE_EVENT, onOpen);
        return () => window.removeEventListener(QUICK_CREATE_EVENT, onOpen);
    }, []);

    // Only product / logo / order need the preloaded deps (companies,
    // and logos for the product BOM). company / station need nothing.
    const needsDeps = kind === 'product' || kind === 'logo' || kind === 'order';

    // Fetch deps the first time a popup that needs them is requested;
    // reuse afterward. State is only set inside the promise callbacks
    // (never synchronously in the effect body); a ref guards duplicates.
    useEffect(() => {
        if (!needsDeps || deps !== null || fetchingRef.current) return;
        fetchingRef.current = true;
        let cancelled = false;
        fetchQuickCreateDepsAction()
            .then((d) => {
                if (!cancelled) setDeps(d);
            })
            .catch((err) => {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : 'Error al cargar');
            })
            .finally(() => {
                fetchingRef.current = false;
            });
        return () => {
            cancelled = true;
        };
    }, [needsDeps, deps]);

    if (kind === null) return null;

    const close = () => setKind(null);

    // Company / station create modals need no preloaded data — render
    // them straight away.
    if (kind === 'company') {
        return (
            <CompaniesManager
                embedded
                autoOpenCreate
                onClose={close}
                initialCompanies={[]}
            />
        );
    }

    if (kind === 'station') {
        return (
            <StationUsersManager
                embedded
                onClose={close}
                initialUsers={[]}
                orderSummaries={[]}
                initialAssignments={[]}
            />
        );
    }

    // Loading / error overlay while deps resolve (product / logo / order).
    if (!deps) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl px-6 py-5 flex items-center gap-3">
                    {error ? (
                        <>
                            <span className="text-sm text-red-600 dark:text-red-400">
                                {error}
                            </span>
                            <button
                                type="button"
                                onClick={close}
                                className="text-sm font-bold text-gray-600 dark:text-zinc-300 hover:underline"
                            >
                                Cerrar
                            </button>
                        </>
                    ) : (
                        <>
                            <Loader2 className="animate-spin text-orange-500" size={20} />
                            <span className="text-sm text-gray-600 dark:text-zinc-300">
                                Cargando…
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (kind === 'product') {
        return (
            <ProductsManager
                embedded
                autoOpenCreate
                onClose={close}
                initialProducts={[]}
                companies={deps.companies}
                logos={deps.logos}
            />
        );
    }

    if (kind === 'logo') {
        return (
            <LogosManager
                embedded
                autoOpenCreate
                onClose={close}
                initialLogos={[]}
                companies={deps.companies}
            />
        );
    }

    return <OrderQuickCreate companies={deps.companies} onClose={close} />;
}
