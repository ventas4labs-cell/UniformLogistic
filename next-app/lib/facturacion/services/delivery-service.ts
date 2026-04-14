// ─── Delivery Service (stub) ─────────────────────────────────────────────
// Triggered after Hacienda accepts a document. In the original project this
// generated the customer-facing PDF and emailed it to the receptor. Stubbed
// here for now — wire to an email provider (Resend, etc.) to enable.

export async function deliverAcceptedDocument(documentId: string): Promise<{ ok: boolean; message: string }> {
    console.log('[FE Delivery] Accepted document ready for delivery (stub):', documentId);
    return { ok: true, message: 'delivery stub — no-op' };
}
