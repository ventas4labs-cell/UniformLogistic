
// Material requirements per product
// Quantities are per single unit of the product
export interface MaterialRequirement {
    fabric_m: number; // Meters of fabric
    buttons: number;
    zippers: number;
    elastic_m: number;
    thread_m: number;
    // Add other materials as needed
}

export const MATERIAL_DATA: Record<string, MaterialRequirement> = {
    // Shirts - Generic Estimates
    'shirt': {
        fabric_m: 1.5,
        buttons: 8,
        zippers: 0,
        elastic_m: 0,
        thread_m: 200,
    },
    // Pants - Generic Estimates
    'pant': {
        fabric_m: 1.8,
        buttons: 1,
        zippers: 1,
        elastic_m: 0.5, // If applicable
        thread_m: 250,
    },
    // Specific Overrides can be added by Product ID if needed
    // 'col-azul-h': { ... }
};

// Specific BOM for Admin PDF Table
export const DETAILED_BOM: Record<string, { label: string; items: { name: string; val: number }[] }> = {
    'shirt': {
        label: 'CAMISA TIPO COLUMBIA',
        items: [
            { name: 'Tela Columbia azul', val: 1.75 },
            { name: 'Tela malla', val: 0.2 },
            { name: 'Botones', val: 11 },
            { name: 'Cordón Elástico', val: 0.28 },
            { name: 'Velcro', val: 0.12 },
            { name: 'Servicio Corte', val: 1 },
            { name: 'Servicio de Sublimado', val: 1 },
            { name: 'Servicio de Bordado', val: 1 },
            { name: 'Servicio de Maquila', val: 1 },
        ]
    }
};

export const getMaterialReq = (type: string, id: string): MaterialRequirement => {
    // Check for specific ID match first, then fallback to type
    return MATERIAL_DATA[id] || MATERIAL_DATA[type] || {
        fabric_m: 0, buttons: 0, zippers: 0, elastic_m: 0, thread_m: 0
    };
};
