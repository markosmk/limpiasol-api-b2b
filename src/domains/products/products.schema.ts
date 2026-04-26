import * as v from "valibot"

export const purchaseRuleSchema = v.object({
  minQuantity: v.number(),
  maxQuantity: v.optional(v.number()),
  stepQuantity: v.number(),
  allowBackorder: v.optional(v.boolean()),
  unitName: v.optional(v.string()),
  isBulk: v.optional(v.boolean()),
  isWholesale: v.optional(v.boolean()),
  isRetail: v.optional(v.boolean())
})

export const priceTierSchema = v.object({
  tierType: v.string(), // 'retail', 'wholesale', 'reseller', etc.
  price: v.union([v.number(), v.string()]),
  compareAtPrice: v.optional(v.nullable(v.union([v.number(), v.string()]))),
  minQuantity: v.optional(v.number(), 1),
  variantSku: v.optional(v.string()) // reference to join with variant during creation if needed, or null for base product
})

/**
 * VARIANTS & IMAGES
 */

const baseVariantFields = {
  name: v.string(),
  sku: v.string(),
  barcode: v.optional(v.nullable(v.string())),
  options: v.record(v.string(), v.string()),
  stock: v.optional(v.number(), 0),
  stockManagement: v.optional(v.boolean(), false),
  image: v.optional(v.nullable(v.string()))
}

const baseImageFields = {
  url: v.string(),
  alt: v.optional(v.string()),
  sortOrder: v.optional(v.number(), 0),
  isPrimary: v.optional(v.boolean(), false),
  variantSku: v.optional(v.string())
}
export const productVariantSchema = v.object(baseVariantFields)
export const productImageSchema = v.object(baseImageFields)

export const productVariantUpdateSchema = v.object({
  id: v.optional(v.string()), // El update permite ID
  // Usamos v.partial para hacer todos los baseFields opcionales en el update
  ...v.partial(v.object(baseVariantFields)).entries
})

export const productImageUpdateSchema = v.object({
  id: v.optional(v.string()),
  ...v.partial(v.object(baseImageFields)).entries
})

/**
 * CREATE SCHEMA & UPDATE
 */

const commonProductFields = {
  slug: v.optional(v.string()),
  description: v.optional(v.string()),
  shortDescription: v.optional(v.string()),
  badge: v.optional(v.nullable(v.string())),
  brandId: v.optional(v.nullable(v.string())),
  purchaseRules: v.optional(purchaseRuleSchema),
  code: v.optional(v.nullable(v.string()))
}

export const createProductSchema = v.object({
  ...commonProductFields,
  name: v.string(), // Requerido al crear
  // Valores por defecto
  status: v.optional(v.picklist(["published", "draft", "inactive"]), "published"),
  isFeatured: v.optional(v.boolean(), false),
  isPricePublic: v.optional(v.boolean(), false),
  // arrays con valor por defecto []
  variants: v.optional(v.array(productVariantSchema), []),
  prices: v.optional(v.array(priceTierSchema), []),
  tags: v.optional(v.array(v.string()), []),
  categories: v.optional(v.array(v.string()), []),
  collections: v.optional(v.array(v.string()), []),
  images: v.optional(v.array(productImageSchema), [])
})

export type CreateProductInput = v.InferOutput<typeof createProductSchema>

export const updateProductSchema = v.object({
  ...commonProductFields,
  name: v.optional(v.string()), // Opcional al actualizar
  // Opcionales puros. Si no vienen, quedan en undefined y la DB no los pisa
  status: v.optional(v.picklist(["published", "draft", "inactive"])),
  isFeatured: v.optional(v.boolean()),
  isPricePublic: v.optional(v.boolean()),

  // Aquí usamos los schemas de UPDATE y SIN valor por defecto (undefined significa "no tocar")
  variants: v.optional(v.array(productVariantUpdateSchema)),
  prices: v.optional(v.array(priceTierSchema)),
  tags: v.optional(v.array(v.string())),
  categories: v.optional(v.array(v.string())),
  collections: v.optional(v.array(v.string())),
  images: v.optional(v.array(productImageUpdateSchema))
})

export type UpdateProductInput = v.InferOutput<typeof updateProductSchema>
