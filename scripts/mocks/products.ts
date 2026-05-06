import type {
  PriceTierInsert,
  ProductCategoryInsert,
  ProductInsert,
  ProductVariantInsert
} from "@/db/pg/products"

export const mockProducts: ProductInsert[] = [
  {
    id: "prod_lavandina",
    name: "Lavandina Concentrada Limpiasol",
    slug: "lavandina-concentrada",
    description: "Lavandina de uso industrial 55g/L. Máximo poder de desinfección.",
    status: "published",
    code: "LAV-001",
    isPricePublic: true
  },
  {
    id: "prod_detergente",
    name: "Detergente Magistral Plus",
    slug: "detergente-magistral",
    description: "Detergente de alto rendimiento para vajilla.",
    status: "published",
    code: "DET-002",
    isPricePublic: true
  },
  {
    id: "prod_escoba",
    name: "Escoba de Cerdas Suaves",
    slug: "escoba-cerdas-suaves",
    description: "Escoba ideal para interiores, cerdas que no rayan.",
    status: "published",
    code: "ESC-003",
    isPricePublic: true
  },
  {
    id: "prod_desengrasante",
    name: "Desengrasante Industrial B2B",
    slug: "desengrasante-industrial",
    description: "Producto químico fuerte solo para venta mayorista.",
    status: "published",
    code: "DES-004",
    isPricePublic: false // Oculto al retail
  }
]

export const mockVariants: ProductVariantInsert[] = [
  // Variantes para Lavandina
  {
    id: "var_lav_1L",
    productId: "prod_lavandina",
    name: "Envase 1 Litro",
    sku: "LAV-001-1L",
    options: { size: "1L" },
    stock: 50
  },
  {
    id: "var_lav_5L",
    productId: "prod_lavandina",
    name: "Bidón 5 Litros",
    sku: "LAV-001-5L",
    options: { size: "5L" },
    stock: 200
  },
  // Default variants for products without specific options
  {
    id: "var_det_std",
    productId: "prod_detergente",
    name: "Estándar 5L",
    sku: "DET-002-STD",
    options: { size: "5L" },
    stock: 100
  },
  {
    id: "var_esc_std",
    productId: "prod_escoba",
    name: "Estándar",
    sku: "ESC-003-STD",
    options: { type: "standard" },
    stock: 80
  },
  {
    id: "var_des_std",
    productId: "prod_desengrasante",
    name: "Industrial 10L",
    sku: "DES-004-10L",
    options: { size: "10L" },
    stock: 30
  }
]

export const mockPriceTiers: PriceTierInsert[] = [
  // Lavandina 1L
  {
    productId: "prod_lavandina",
    variantId: "var_lav_1L",
    tierType: "retail",
    price: "1200.00"
  },
  {
    productId: "prod_lavandina",
    variantId: "var_lav_1L",
    tierType: "reseller",
    price: "850.00",
    volumeDiscounts: [
      { quantity: 10, discountPercent: 5 },
      { quantity: 50, discountPercent: 10 }
    ]
  },
  // Lavandina 5L
  {
    productId: "prod_lavandina",
    variantId: "var_lav_5L",
    tierType: "retail",
    price: "5000.00"
  },
  {
    productId: "prod_lavandina",
    variantId: "var_lav_5L",
    tierType: "reseller",
    price: "3500.00"
  },
  // Detergente
  {
    productId: "prod_detergente",
    variantId: "var_det_std",
    tierType: "retail",
    price: "2500.00"
  },
  {
    productId: "prod_detergente",
    variantId: "var_det_std",
    tierType: "reseller",
    price: "1800.00"
  },
  // Escoba
  {
    productId: "prod_escoba",
    variantId: "var_esc_std",
    tierType: "retail",
    price: "3200.00"
  },
  {
    productId: "prod_escoba",
    variantId: "var_esc_std",
    tierType: "reseller",
    price: "2000.00"
  },
  // Desengrasante (Solo reseller)
  {
    productId: "prod_desengrasante",
    variantId: "var_des_std",
    tierType: "reseller",
    price: "8000.00"
  }
]

export const mockProductCategories: ProductCategoryInsert[] = [
  { productId: "prod_lavandina", categoryId: "cat_limpieza_hogar", isPrimary: true },
  { productId: "prod_lavandina", categoryId: "cat_industrial", isPrimary: false },
  { productId: "prod_detergente", categoryId: "cat_limpieza_hogar", isPrimary: true },
  { productId: "prod_escoba", categoryId: "cat_accesorios", isPrimary: true },
  { productId: "prod_desengrasante", categoryId: "cat_industrial", isPrimary: true }
]
