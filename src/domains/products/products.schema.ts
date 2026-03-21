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

export const productVariantSchema = v.object({
  name: v.string(),
  sku: v.string(),
  options: v.record(v.string(), v.string()),
  stock: v.optional(v.number(), 0),
  stockManagement: v.optional(v.boolean(), false),
  image: v.optional(v.nullable(v.string()))
})

export const priceTierSchema = v.object({
  tierType: v.string(), // 'retail', 'wholesale', 'reseller', etc.
  price: v.union([v.number(), v.string()]),
  compareAtPrice: v.optional(v.nullable(v.union([v.number(), v.string()]))),
  minQuantity: v.optional(v.number(), 1),
  sku: v.optional(v.string()) // reference to join with variant during creation if needed, or null for base product
})

export const productImageSchema = v.object({
  url: v.string(),
  alt: v.optional(v.string()),
  sortOrder: v.optional(v.number(), 0),
  isPrimary: v.optional(v.boolean(), false),
  variantSku: v.optional(v.string())
})

export const createProductSchema = v.object({
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  shortDescription: v.optional(v.string()),
  status: v.optional(v.picklist(["published", "draft", "inactive"]), "published"),
  isFeatured: v.optional(v.boolean(), false),
  badge: v.optional(v.nullable(v.string())),
  brandId: v.optional(v.nullable(v.string())),
  purchaseRules: v.optional(purchaseRuleSchema),
  sku: v.optional(v.nullable(v.string())),
  code: v.optional(v.nullable(v.string())),
  barcode: v.optional(v.nullable(v.string())),
  isPricePublic: v.optional(v.boolean(), false),

  // Nested creation
  variants: v.optional(v.array(productVariantSchema), []),
  prices: v.optional(v.array(priceTierSchema), []),
  tags: v.optional(v.array(v.string()), []), // Slugs or IDs of tags
  categories: v.optional(v.array(v.string()), []), // IDs of categories
  collections: v.optional(v.array(v.string()), []), // IDs of collections
  images: v.optional(v.array(productImageSchema), []) // Array of images
})

export type CreateProductInput = v.InferOutput<typeof createProductSchema>

// --- UPDATE SCHEMA ---
export const productVariantUpdateSchema = v.object({
  id: v.optional(v.string()), // If present, update. If absent, create.
  name: v.optional(v.string()),
  sku: v.optional(v.string()),
  options: v.optional(v.record(v.string(), v.string())),
  stock: v.optional(v.number()),
  stockManagement: v.optional(v.boolean()),
  image: v.optional(v.nullable(v.string()))
})

export const productImageUpdateSchema = v.object({
  id: v.optional(v.string()),
  url: v.optional(v.string()),
  alt: v.optional(v.nullable(v.string())),
  sortOrder: v.optional(v.number()),
  isPrimary: v.optional(v.boolean()),
  variantSku: v.optional(v.string())
})

export const updateProductSchema = v.object({
  name: v.optional(v.string()),
  slug: v.optional(v.string()),
  description: v.optional(v.string()),
  shortDescription: v.optional(v.string()),
  status: v.optional(v.picklist(["published", "draft", "inactive"])),
  isFeatured: v.optional(v.boolean()),
  badge: v.optional(v.nullable(v.string())),
  brandId: v.optional(v.nullable(v.string())),
  purchaseRules: v.optional(purchaseRuleSchema),
  sku: v.optional(v.nullable(v.string())),
  code: v.optional(v.nullable(v.string())),
  barcode: v.optional(v.nullable(v.string())),
  isPricePublic: v.optional(v.boolean()),

  // Syncing associations
  variants: v.optional(v.array(productVariantUpdateSchema)),
  prices: v.optional(v.array(priceTierSchema)), // We can reuse priceTierSchema, it has optional sku
  tags: v.optional(v.array(v.string())),
  categories: v.optional(v.array(v.string())),
  collections: v.optional(v.array(v.string())),
  images: v.optional(v.array(productImageUpdateSchema))
})

export type UpdateProductInput = v.InferOutput<typeof updateProductSchema>
