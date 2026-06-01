import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft,
    Building2,
    Calendar,
    Mail,
    MapPin,
    Phone,
    User
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { fetchCompanyById } from '@/lib/services/companies';
import { fetchOrdersForCompany } from '@/lib/services/orders';
import { fetchStageCompletionsForOrders } from '@/lib/services/stage-completions';
import { CompanyDetail } from '@/components/admin/company-detail';

export default async function CompanyDetailPage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();
    const company = await fetchCompanyById(supabase, id);
    if (!company) notFound();

    const orders = await fetchOrdersForCompany(supabase, company.id);
    const orderIds = orders.map((o) => o.uuid).filter((x): x is string => !!x);
    const completions = await fetchStageCompletionsForOrders(supabase, orderIds);
    const completionsList = Array.from(completions.entries()).flatMap(
        ([orderId, perStage]) =>
            Array.from(perStage.values()).map((c) => ({
                orderId,
                stage: c.stage,
                completedAt: c.completedAt
            }))
    );

    return (
        <div>
            <Link
                href="/admin/companies"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 dark:text-zinc-400 hover:text-orange-600 dark:hover:text-orange-400 mb-4"
            >
                <ArrowLeft size={14} /> Empresas
            </Link>

            <header className="mb-6">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                        <Building2 size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                                {company.name}
                            </h1>
                            <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    company.isActive
                                        ? 'bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300'
                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                                }`}
                            >
                                {company.isActive ? 'Activa' : 'Inactiva'}
                            </span>
                        </div>
                        <p className="text-sm font-mono text-gray-500 dark:text-zinc-400 mt-0.5">
                            Cédula Jurídica · {company.documentNumber}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-5">
                    <DetailField
                        icon={<User size={14} />}
                        label="Contacto"
                        value={company.contactName || '—'}
                    />
                    <DetailField
                        icon={<Mail size={14} />}
                        label="Email"
                        value={company.email || '—'}
                        href={company.email ? `mailto:${company.email}` : undefined}
                    />
                    <DetailField
                        icon={<Phone size={14} />}
                        label="Teléfono"
                        value={company.phone || '—'}
                        href={company.phone ? `tel:${company.phone}` : undefined}
                    />
                    <DetailField
                        icon={<MapPin size={14} />}
                        label="Dirección"
                        value={company.address || '—'}
                        className="sm:col-span-2"
                    />
                    <DetailField
                        icon={<Calendar size={14} />}
                        label="Registrada"
                        value={new Date(company.createdAt).toLocaleDateString()}
                    />
                </div>
            </header>

            <CompanyDetail
                companyName={company.name}
                orders={orders}
                initialStageCompletions={completionsList}
            />
        </div>
    );
}

function DetailField({
    icon,
    label,
    value,
    href,
    className
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    href?: string;
    className?: string;
}) {
    const body = (
        <div className={`flex items-start gap-2.5 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 ${className || ''}`}>
            <span className="mt-0.5 text-gray-400 dark:text-zinc-500">{icon}</span>
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
                    {label}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">
                    {value}
                </p>
            </div>
        </div>
    );
    return href ? (
        <a href={href} className="hover:[&>div]:border-orange-300 dark:hover:[&>div]:border-orange-700 transition-colors">
            {body}
        </a>
    ) : (
        body
    );
}
