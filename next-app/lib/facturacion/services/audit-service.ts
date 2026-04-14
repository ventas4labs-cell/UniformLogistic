import { createAdminClient } from "@/lib/supabase-admin";

export const AUDIT_ACTIONS = {
    EMIT: "document_emitted",
    RETRY: "document_retried",
    STATUS_UPDATE: "status_updated",
    CONFIG_SAVED: "config_saved",
    CERT_UPLOADED: "certificate_uploaded",
    MSG_SENT: "mensaje_receptor_sent",
} as const;

export async function logAuditEvent(params: {
    branch_id?: string;
    action: string;
    document_id?: string;
    clave?: string;
    user_id?: string;
    details?: Record<string, unknown>;
}): Promise<void> {
    try {
        const supabase = createAdminClient();
        const { error } = await supabase.from("fe_audit_log").insert({
            branch_id: params.branch_id ?? null,
            action: params.action,
            document_id: params.document_id ?? null,
            clave: params.clave ?? null,
            user_id: params.user_id ?? null,
            details: params.details ?? null,
        });

        if (error) {
            console.error("[fe-audit] Failed to log audit event:", error.message);
        }
    } catch (err) {
        console.error("[fe-audit] Unexpected error logging audit event:", err);
    }
}
