import 'server-only';

// ─── Reusable Resend sender (HTML-capable) ───────────────────────────
// The facturación module already talks to Resend via fetch for FE PDFs;
// this is the general-purpose customer-notification sender (quotes,
// completed orders, overdue reminders) that supports HTML bodies.
//
// Config (env):
//   RESEND_API_KEY       required to actually send; absent → skipped
//   RESEND_FROM_ADDRESS  "Name <addr>" or a bare verified address
//   RESEND_REPLY_TO      defaults to ulogisticcr@gmail.com

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

export interface SendResult {
    ok: boolean;
    skipped?: boolean;
    error?: string;
    messageId?: string;
}

// Falls back to the verified Resend domain (uniformlogisticcr.com) so
// sends work even if RESEND_FROM_ADDRESS isn't set.
const FALLBACK_FROM = 'Uniform Logistic <no-reply@uniformlogisticcr.com>';
const FALLBACK_REPLY_TO = 'ulogisticcr@gmail.com';

/**
 * Resend API key. The canonical name is RESEND_API_KEY, but the
 * production project has historically stored it as `Resend_API` — env
 * names are case-sensitive in Node, so reading only the canonical name
 * silently disabled EVERY email in production. Accept the known
 * aliases so a rename isn't required (and keeps working after one).
 */
export function resolveResendApiKey(): string | undefined {
    return (
        process.env.RESEND_API_KEY ||
        process.env.Resend_API ||
        process.env.RESEND_API ||
        undefined
    );
}

function resolveFrom(): string {
    const raw = process.env.RESEND_FROM_ADDRESS?.trim();
    if (!raw) return FALLBACK_FROM;
    // Accept either "Uniform Logistic <addr>" or a bare "addr".
    return raw.includes('<') ? raw : `Uniform Logistic <${raw}>`;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
    const apiKey = resolveResendApiKey();
    if (!apiKey) {
        console.warn(
            '[email] No Resend API key found (RESEND_API_KEY / Resend_API) — skipping send to',
            opts.to
        );
        return { ok: false, skipped: true, error: 'RESEND_API_KEY no está configurada.' };
    }
    const replyTo = opts.replyTo || process.env.RESEND_REPLY_TO || FALLBACK_REPLY_TO;

    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: resolveFrom(),
                to: opts.to,
                subject: opts.subject,
                html: opts.html,
                ...(opts.text ? { text: opts.text } : {}),
                reply_to: replyTo
            })
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { ok: false, error: `HTTP ${res.status} ${text}` };
        }
        const data = (await res.json()) as { id?: string };
        return { ok: true, messageId: data.id };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}
