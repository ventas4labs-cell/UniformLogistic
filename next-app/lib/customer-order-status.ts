import type { Order } from '@/lib/types';
import { orderApplicableStages } from '@/lib/stage-utils';
import type { CompletionIndex } from '@/lib/services/stage-completions';
import type { DispatchTotalsByOrder } from '@/lib/services/dispatches';

// ─── Customer-facing order status ────────────────────────────────────
//
// The customer sees ONE bit about a live order: is it still being made
// ("Pendiente"), or is it finished and waiting to move ("Listo").
//
// Everything the workshop tracks internally — which of the parallel
// stages are done, how many pieces were dispatched, how much landed in
// stock — is deliberately NOT exposed here. It changed hourly, meant
// nothing to the customer, and made the dashboard read like a production
// terminal instead of an order status page.
//
// Readiness is still DERIVED from that real progress (order_stage_
// completions + order_dispatches), never from the legacy orders.status
// column, which stays "pending" for an order's whole life:
//   pending   → still being made
//   ready     → made: packed for dispatch, or sitting in the customer's
//                bodega waiting to be delivered
//   completed → actually delivered
//   cancelled → order cancelled

export type CustomerBucket = 'pending' | 'ready' | 'completed' | 'cancelled';

export interface CustomerOrderProgress {
    bucket: CustomerBucket;
    /** "Pendiente" / "Listo" / "Entregado" / "Cancelado". */
    statusLabel: string;
    totalPieces: number;
}

export function deriveOrderProgress(
    order: Order,
    completions: CompletionIndex,
    dispatchTotals: DispatchTotalsByOrder,
    // Same shape as dispatchTotals — how much of each line was pushed
    // into the company's stock.
    stockTotals?: DispatchTotalsByOrder,
    // True once the delivery module has marked the order delivered. Only
    // a real delivery (not merely being dispatched) completes the order.
    delivered = false
): CustomerOrderProgress {
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

    // All applicable stages done = the order is made. Which ones, and in
    // what order, stays internal.
    const applicable = orderApplicableStages(order);
    const perOrder = order.uuid ? completions.get(order.uuid) : undefined;
    const allStagesDone =
        applicable.length > 0 && applicable.every((key) => !!perOrder?.get(key));

    // Fully dispatched means packed & out the door — NOT delivered. The
    // delivery module marks the actual delivery.
    let dispatchedPieces = 0;
    const dt = order.uuid ? dispatchTotals.get(order.uuid) : undefined;
    if (dt) for (const q of dt.values()) dispatchedPieces += q;
    const fullyDispatched = totalPieces > 0 && dispatchedPieces >= totalPieces;

    let stockedPieces = 0;
    const st = order.uuid ? stockTotals?.get(order.uuid) : undefined;
    if (st) for (const q of st.values()) stockedPieces += q;
    const fullyStocked = totalPieces > 0 && stockedPieces >= totalPieces;

    if (order.status === 'cancelled') {
        return { bucket: 'cancelled', statusLabel: 'Cancelado', totalPieces };
    }
    if (order.status === 'completed' || delivered) {
        // Closed only once the order was actually delivered. Being
        // dispatched or stocked is NOT delivery.
        return {
            bucket: 'completed',
            statusLabel: delivered ? 'Entregado' : 'Completado',
            totalPieces
        };
    }
    if (fullyStocked || fullyDispatched || allStagesDone) {
        // Made. Pieces sitting in the customer's own bodega count here
        // too — they are finished goods waiting on a delivery, so the
        // customer can ask for them from /stock.
        return { bucket: 'ready', statusLabel: 'Listo', totalPieces };
    }
    return { bucket: 'pending', statusLabel: 'Pendiente', totalPieces };
}
