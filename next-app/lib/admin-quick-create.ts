// Lightweight pub-sub so any fast-action button (top bar or home grid)
// can pop a create modal handled by the QuickCreateHost mounted once in
// the admin shell — without each surface having to own modal state or
// the (heavy) form component.

export type QuickCreateKind = 'product' | 'logo' | 'company' | 'station' | 'order';

export const QUICK_CREATE_EVENT = 'ul:quick-create';

export function openQuickCreate(kind: QuickCreateKind) {
    window.dispatchEvent(
        new CustomEvent<QuickCreateKind>(QUICK_CREATE_EVENT, { detail: kind })
    );
}
