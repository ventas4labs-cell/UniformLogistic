import { Product } from './types';

export const PRODUCTS: Product[] = [
  // Columbia
  {
    id: 'col-azul-h',
    name: 'Columbia Azul de Hombre',
    type: 'shirt',
    image: '/products/shirt-blue.png',
    description: 'Camisa Columbia Azul para caballeros.',
    category: 'Men',
    sizes: {
      men: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
    },
  },
  {
    id: 'col-azul-m',
    name: 'Columbia Azul de Mujer',
    type: 'shirt',
    image: '/products/shirt-blue.png',
    description: 'Camisa Columbia Azul corte de dama.',
    category: 'Women',
    sizes: {
      women: ['S', 'M', 'L', 'XL', '2XL', '3XL']
    },
  },
  {
    id: 'col-gris-h',
    name: 'Columbia Gris de Hombre',
    type: 'shirt',
    image: '/products/shirt-grey.png',
    description: 'Camisa Columbia Gris para caballeros.',
    category: 'Men',
    sizes: {
      men: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL']
    },
  },
  {
    id: 'col-gris-m',
    name: 'Columbia Gris de Mujer',
    type: 'shirt',
    image: '/products/shirt-grey.png',
    description: 'Camisa Columbia Gris corte de dama.',
    category: 'Women',
    sizes: {
      women: ['S', 'M', 'L', 'XL', '2XL', '3XL']
    },
  },

  // Dockers
  {
    id: 'dock-beige-h',
    name: 'Docker Beige de Hombre',
    type: 'pant',
    image: '/products/pant-beige.png',
    description: 'Pantalón Docker Beige para caballeros.',
    category: 'Men',
    sizes: {
      waist: [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52],
    },
  },
  {
    id: 'dock-beige-m',
    name: 'Docker Beige de Mujer',
    type: 'pant',
    image: '/products/pant-beige.png',
    description: 'Pantalón Docker Beige corte de dama.',
    category: 'Women',
    sizes: {
      waist: [6, 8, 10, 12, 14, 16, 18, 20, 22],
    },
  },

  // Cargos
  {
    id: 'cargo-gris',
    name: 'Cargo Gris',
    type: 'pant',
    image: '/products/pant-grey.png',
    description: 'Pantalón Cargo color Gris.',
    category: 'Men',
    sizes: {
      waist: [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52],
    },
  },
  {
    id: 'cargo-verde',
    name: 'Cargo Verde',
    type: 'pant',
    image: '/products/pant-grey.png',
    description: 'Pantalón Cargo color Verde.',
    category: 'Men',
    sizes: {
      waist: [30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52],
    },
  },

  // Jackets
  {
    id: 'jacket-gen-h',
    name: 'Jacket Genérica Hombre',
    type: 'shirt',
    image: '/products/jacket-men.png',
    description: 'Jacket genérica para caballeros.',
    category: 'Men',
    sizes: {
      men: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] // S-XXXXL
    },
  },
  {
    id: 'jacket-gen-m',
    name: 'Jacket Genérica Mujer',
    type: 'shirt',
    image: '/products/jacket-women.png',
    description: 'Jacket genérica corte de dama.',
    category: 'Women',
    sizes: {
      women: ['S', 'M', 'L', 'XL', '2XL', '3XL'] // S-XXXL
    },
  },
  {
    id: 'jacket-ref-h',
    name: 'Jacket Reflectiva Hombre',
    type: 'shirt',
    image: '/products/jacket-men.png',
    description: 'Jacket reflectiva de seguridad para caballeros.',
    category: 'Men',
    sizes: {
      men: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] // S-XXXXL
    },
  },
  {
    id: 'jacket-ref-m',
    name: 'Jacket Reflectiva Mujer',
    type: 'shirt',
    image: '/products/jacket-women.png',
    description: 'Jacket reflectiva de seguridad corte de dama.',
    category: 'Women',
    sizes: {
      women: ['S', 'M', 'L', 'XL', '2XL', '3XL'] // S-XXXL
    },
  },
];

export const BRAND_COLOR = '#F57C00'; // Orange
export const BRAND_COLOR_TAILWIND = 'orange-600';