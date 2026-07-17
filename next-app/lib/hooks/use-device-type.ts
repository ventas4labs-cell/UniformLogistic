'use client';

import { useEffect, useState } from 'react';
import { classifyDevice, type DeviceType } from '@/lib/device';

export interface DeviceInfo {
    type: DeviceType;
    isPhone: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    /** Coarse (touch) primary pointer — true on phones/tablets. */
    isTouch: boolean;
    width: number;
    /** False during SSR + first paint; true once measured on the client.
     *  Gate any device-specific render on this to avoid a hydration flash. */
    ready: boolean;
}

// Reactive device classification for client components: reacts to
// resize + pointer changes. iPad-safe (width + coarse pointer).
export function useDeviceType(): DeviceInfo {
    const [state, setState] = useState<{
        type: DeviceType;
        touch: boolean;
        width: number;
        ready: boolean;
    }>({ type: 'desktop', touch: false, width: 1280, ready: false });

    useEffect(() => {
        const coarse = window.matchMedia('(pointer: coarse)');
        const compute = () => {
            const width = window.innerWidth;
            const touch = coarse.matches;
            setState({ type: classifyDevice(width, touch), touch, width, ready: true });
        };
        compute();
        window.addEventListener('resize', compute);
        coarse.addEventListener?.('change', compute);
        return () => {
            window.removeEventListener('resize', compute);
            coarse.removeEventListener?.('change', compute);
        };
    }, []);

    return {
        type: state.type,
        isPhone: state.type === 'phone',
        isTablet: state.type === 'tablet',
        isDesktop: state.type === 'desktop',
        isTouch: state.touch,
        width: state.width,
        ready: state.ready
    };
}
