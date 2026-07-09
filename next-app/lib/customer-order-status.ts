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
//   completed  → delivered (fully dispatched) or manually completed
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
    dispatchTotals: DispatchTotalsByOrder
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

    // Delivered pieces = sum of every dispatched line for this order.
    let deliveredPieces = 0;
    const dt = order.uuid ? dispatchTotals.get(order.uuid) : undefined;
    if (dt) for (const q of dt.values()) deliveredPieces += q;
    const fullyDelivered = totalPieces > 0 && deliveredPieces >= totalPieces;

    let bucket: CustomerBucket;
    let statusLabel: string;
    if (order.status === 'cancelled') {
        bucket = 'cancelled';
        statusLabel = 'Cancelado';
    } else if (order.status === 'completed' || fullyDelivered) {
        // Delivery is the strongest completion signal for a customer —
        // if every piece has been dispatched, the order is done for them
        // regardless of which stages were checked off in the workshop.
        bucket = 'completed';
        statusLabel = 'Entregado';
    } else if (allStagesDone) {
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
        deliveredPieces
    };
}
