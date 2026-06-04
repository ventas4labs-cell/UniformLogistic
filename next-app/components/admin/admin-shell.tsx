import { cookies } from 'next/headers';
import { AdminMenu } from '@/components/admin/admin-menu';
import { AdminFastActions } from '@/components/admin/admin-fast-actions';
import { FAST_ACTIONS_COOKIE, resolveFastActions } from '@/lib/admin-fast-actions';

interface Props {
    children: React.ReactNode;
}

// Admin shell with no permanent sidebar. A slim sticky top bar carries
// the Uniform Logistic logo button (top-left) which morphs to a dot
// grid on hover and opens an app-launcher popup with every module, plus
// configurable one-click fast actions on the right. Dropping the
// sidebar gives each module the full page width.
export async function AdminShell({ children }: Props) {
    const store = await cookies();
    const fastActions = resolveFastActions(store.get(FAST_ACTIONS_COOKIE)?.value);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 transition-colors">
            <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-gray-200 dark:border-zinc-800">
                <AdminMenu />
                <span className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline">
                    Uniform Logistic
                </span>
                <AdminFastActions initial={fastActions} />
            </header>

            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">{children}</div>
            </main>
        </div>
    );
}
