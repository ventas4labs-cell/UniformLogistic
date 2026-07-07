import { createClient } from '@/utils/supabase/server';
import { LoginForm } from './login-form';

// The login page must ALWAYS render the form — never redirect an already
// authenticated user away. A station user reaching /login would otherwise
// bounce /login → /home → /station (the (app) layout sends stations to
// /station), trapping them with no way to switch accounts. Instead we show
// the current session and let them sign out to get back into the system.
export default async function LoginPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return <LoginForm currentEmail={user?.email ?? null} />;
}
