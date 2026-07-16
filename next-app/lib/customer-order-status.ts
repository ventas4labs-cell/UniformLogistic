import type { Order } from '@/lib/types';
import { orderApplicableStages } from '@/lib/stage-utils';
import {
    STAGE_LABELS,
    type StageKey,
    type CompletionIndex
} from '@/lib/services/stage-completions';
import type { DispatchTotalsByOrder } from '@/lib/services/dispatches';

// ─── Customer-facing order status, derived from real progress ────────
//
// The production workflow is PARALLEL: an order's stages are tracked in
// order_stage_completions (one row per finished stage), and delivery in
// order_dispatches — NOT in the legacy orders.status column, which now
// stays "pending" for its whole life. Reading orders.status made every
// customer order look "Pendiente / En producción" forever.
//
// This mirrors the admin's bucketFor (all applicable stages done = made)
// and adds the delivery split the customer dashboard needs:
//   production → still being made (not all stages done)
//   ready      → made & packed, not yet delivered
//   completed  → delivered (fully dispatched), fully moved into the
//                customer's stock, or manually completed
//   cancelled  → order cancelled

export type CustomerBucket = 'production' | 'ready' | 'completed' | 'cancelled';

export interface CustomerStageState {
    key: StageKey;
    label: string;
    done: boolean;
}

export interface CustomerOrderProgress {
    bucket: CustomerBucket;
    statusLabel: string;
    stages: CustomerStageState[];
    doneCount: number;
    totalStages: number;
    totalPieces: number;
    deliveredPieces: number;
}

export function deriveOrderProgress(
    order: Order,
    completions: CompletionIndex,
    dispatchTotals: DispatchTotalsByOrder,
    // Same shape as dispatchTotals — how much of each line was pushed
    // into the company's stock. Optional so older callers still compile.
    stockTotals?: DispatchTotalsByOrder,
    // True once the delivery module has marked the order delivered. Only
    // a real delivery (not merely being dispatched) completes the order.
    delivered = false
): CustomerOrderProgress {
    const totalPieces = order.items.reduce((s, i) => s + i.quantity, 0);

    const applicable = orderApplicableStages(order);
    const perOrder = order.uuid ? completions.get(order.uuid) : undefined;
    const stages: CustomerStageState[] = applicable.map((key) => ({
        key,
        label: STAGE_LABELS[key],
        done: !!perOrder?.get(key)
    }));
    const doneCount = stages.filter((s) => s.done).length;
    const totalStages = stages.length;
    const allStagesDone = totalStages > 0 && doneCount === totalStages;

    // Dispatched pieces = sum of every dispatched line for this order.
    // Being fully dispatched means the order is packed & ready to leave —
    // NOT delivered. The delivery module marks the actual delivery.
    let dispatchedPieces = 0;
    const dt = order.uuid ? dispatchTotals.get(order.uuid) : undefined;
    if (dt) for (const q of dt.values()) dispatchedPieces += q;
    const fullyDispatched = totalPieces > 0 && dispatchedPieces >= totalPieces;

    // Stocked pieces = sum of every line pushed into the company's stock.
    let stockedPieces = 0;
    const st = order.uuid ? stockTotals?.get(order.uuid) : undefined;
    if (st) for (const q of st.values()) stockedPieces += q;
    const fullyStocked = totalPieces > 0 && stockedPieces >= totalPieces;

    let bucket: CustomerBucket;
    let statusLabel: string;
    if (order.status === 'cancelled') {
        bucket = 'cancelled';
        statusLabel = 'Cancelado';
    } else if (order.status === 'completed' || delivered || fullyStocked) {
        // Completion for the customer: the order was actually delivered
        // (by the delivery module) or every piece moved into their stock
        // ("Mi almacén"). Being merely dispatched is NOT completion.
        bucket = 'completed';
        statusLabel = delivered
            ? 'Entregado'
            : fullyStocked
                ? 'En stock'
                : 'Completado';
    } else if (fullyDispatched || allStagesDone) {
        // Packed & dispatched (or all stages done) → waiting for the
        // courier. Shows in the customer's "Listos para despacho" list.
        bucket = 'ready';
        statusLabel = 'Listo para despacho';
    } else {
        bucket = 'production';
        statusLabel =
            totalStages > 0 ? `En producción · ${doneCount}/${totalStages}` : 'En producción';
    }

    return {
        bucket,
        statusLabel,
        stages,
        doneCount,
        totalStages,
        totalPieces,
        deliveredPieces: dispatchedPieces
    };
}
