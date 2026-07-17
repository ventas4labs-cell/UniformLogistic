import 'server-only';
import { headers } from 'next/headers';
import { userAgent } from 'next/server';
import { deviceFromUaType, type DeviceType } from '@/lib/device';

// Server-side device hint from the request user-agent — usable in server
// components/layouts to render a no-flash device class or skip a
// desktop-only widget on phones. COARSE: it can't see the viewport and
// modern iPads report as desktop, so treat it as a hint; the client hook
// (useDeviceType) and CSS media queries are authoritative for layout.
export async function getServerDevice(): Promise<DeviceType> {
    const h = await headers();
    const { device } = userAgent({ headers: h });
    return deviceFromUaType(device.type);
}
