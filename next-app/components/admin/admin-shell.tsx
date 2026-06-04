import { AdminMenu } from '@/components/admin/admin-menu';

interface Props {
    children: React.ReactNode;
}

// Admin shell with no permanent sidebar. A slim sticky top bar carries
// the Uniform Logistic logo button (top-left) which morphs to a dot
// grid on hover and opens an app-launcher popup with every module.
// Dropping the sidebar gives each module the full page width.
export function AdminShell({ children }: Props) {
    return (
        <div className="min-h-screen bg-gray-100 dark:bg-zinc-950 transition-colors">
            <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-gray-200 dark:border-zinc-800">
                <AdminMenu />
                <span className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Uniform Logistic
                </span>
            </header>

            <main className="p-4 sm:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">{children}</div>
            </main>
        </div>
    );
}
