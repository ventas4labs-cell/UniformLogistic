import { SetNewPasswordForm } from '@/components/company-reset-forms';

export const metadata = { title: 'Nueva contraseña — Uniform Logistic' };

export default async function ResetWithTokenPage({
    params
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    return <SetNewPasswordForm token={token} />;
}
