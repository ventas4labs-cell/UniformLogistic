'use client';

import { useEffect } from 'react';
import { useDeviceType } from '@/lib/hooks/use-device-type';

// Reflects the (accurate, viewport+pointer) device class onto <html> as
// data-device="phone|tablet|desktop", so CSS (e.g. .hide-on-phone) and
// component logic can target the real device app-wide. Renders nothing.
export function DeviceClass() {
    const { type, ready } = useDeviceType();
    useEffect(() => {
        if (ready) document.documentElement.dataset.device = type;
    }, [type, ready]);
    return null;
}
