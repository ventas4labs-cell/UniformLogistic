// ─── Device classification (shared, pure) ──────────────────────────
// Used by the client hook (useDeviceType) and the server hint
// (getServerDevice). No 'use client' / no next imports so both can use it.

export type DeviceType = 'phone' | 'tablet' | 'desktop';

// Classify from viewport width + whether the primary pointer is coarse
// (touch). This is the reliable path — it reacts to the real window and
// handles the tricky cases:
//   • iPad reports a *desktop* user-agent but a coarse pointer, so a
//     touch device at a tablet-ish width lands as 'tablet' (not desktop).
//   • A desktop window shrunk narrow still reads as phone/tablet, which
//     is what you want for layout.
export function classifyDevice(width: number, touch: boolean): DeviceType {
    if (width < 768) return 'phone';
    if (width < 1024) return 'tablet';
    // Large touch screens (iPad landscape, Surface) → still a tablet.
    if (touch && width < 1366) return 'tablet';
    return 'desktop';
}

// Map the parsed user-agent device.type (from next/server's userAgent)
// to our set. SERVER HINT ONLY: width is unknown here and modern iPads
// masquerade as desktop, so this is a coarse guess — prefer the client
// hook / CSS media queries for anything layout-critical.
export function deviceFromUaType(uaType: string | undefined): DeviceType {
    if (uaType === 'mobile') return 'phone';
    if (uaType === 'tablet') return 'tablet';
    return 'desktop';
}
