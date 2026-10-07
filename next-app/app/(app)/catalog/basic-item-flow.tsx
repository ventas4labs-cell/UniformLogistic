'use client';

import { useState } from 'react';
import { SizeSelector } from '@/components/size-selector';
import { BasicOrderStudio } from '@/components/custom-order/basic-order-studio';
import type { AdminProduct } from '@/lib/services/products';
import type { ThreeDModel } from '@/lib/services/three-d-models';
import type { Logo } from '@/lib/services/logos';
import type { SizeSelection } from '@/lib/types';

// Basic-item order flow: pick sizes → 3D logo placement → order or request.
export function BasicItemFlow({
    product,
    model,
    logos,
    adminOrder,
    onClose
}: {
    product: AdminProduct;
    model: ThreeDModel;
    logos: Logo[];
    adminOrder: boolean;
    onClose: () => void;
}) {
    const [sizeItems, setSizeItems] = useState<
        { selection: SizeSelection; quantity: number }[] | null
    >(null);

    if (!sizeItems) {
        return (
            <SizeSelector
                product={product}
                onCancel={onClose}
                onAdd={(items) => setSizeItems(items)}
            />
        );
    }

    return (
        <BasicOrderStudio
            product={{ code: product.id, name: product.name }}
            model={model}
            logos={logos}
            sizeItems={sizeItems}
            adminOrder={adminOrder}
            onBack={() => setSizeItems(null)}
            onClose={onClose}
        />
    );
}
