import { db } from "@/db"
import {
  type PriceTierInsert,
  type ProductInsert,
  type ProductVariantInsert,
  priceTiers,
  products,
  productVariants
} from "@/db/pg"

export const factories = {
  async createProduct(overrides = {} as Partial<ProductInsert>) {
    const [product] = await db
      .insert(products)
      .values({
        name: `Test Product ${Date.now()}`,
        slug: `test-product-${Date.now()}`,
        status: "published",
        ...overrides
      })
      .returning({ id: products.id })
    if (!product) throw new Error("Failed to create product")
    return product
  },

  async createPriceTier(overrides = {} as Partial<PriceTierInsert>) {
    const [tier] = await db
      .insert(priceTiers)
      .values({
        productId: overrides.productId || "prod-default",
        tierType: "retail",
        price: "100.00",
        ...overrides
      })
      .returning({ id: priceTiers.id })
    if (!tier) throw new Error("Failed to create price tier")
    return tier
  },

  async createVariant(overrides = {} as Partial<ProductVariantInsert>) {
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: overrides.productId || "prod-default",
        name: "Default Variant",
        sku: `VAR-${Date.now()}`,
        options: {},
        ...overrides
      })
      .returning({ id: productVariants.id })
    if (!variant) throw new Error("Failed to create variant")
    return variant
  }
}
