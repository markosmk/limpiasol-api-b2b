import { createId } from "@paralleldrive/cuid2"
import { and, eq, inArray, isNull } from "drizzle-orm"
import type { ProductInsert } from "@/db/schema/products"
import type { ProductSummary } from "./products.types"

import { db } from "@/db"
import {
  priceTiers,
  productCategories,
  productCollections,
  productImages,
  products,
  productTags,
  productVariants,
  tags
} from "@/db/schema"

export class ProductsRepository {
  async create(product: ProductInsert) {
    return await db.insert(products).values(product)
  }

  async createWithFullDetails(
    productData: ProductInsert,
    {
      variants = [],
      prices = [],
      categories: categoryIds = [],
      tags: tagSlugs = [],
      collections: collectionIds = [],
      images = []
    }: {
      variants?: Omit<typeof productVariants.$inferInsert, "productId">[]
      prices?: (Omit<typeof priceTiers.$inferInsert, "productId"> & { sku?: string })[]
      categories?: string[]
      tags?: string[]
      collections?: string[]
      images?: (Omit<typeof productImages.$inferInsert, "productId"> & { variantSku?: string })[]
    }
  ) {
    return await db.transaction(async (tx) => {
      // 1. Create Product
      await tx.insert(products).values(productData)
      const productId = productData.id!

      // 2. Create Variants
      const variantMap = new Map<string, string>() // sku -> id
      if (variants.length > 0) {
        for (const variant of variants) {
          const vId = variant.id || createId()
          await tx
            .insert(productVariants)
            .values({ ...variant, id: vId, productId } as typeof productVariants.$inferInsert)
          variantMap.set(variant.sku, vId)
        }
      }

      // 3. Create Prices
      if (prices.length > 0) {
        const pricesToInsert = prices.map((p) => {
          const { sku, ...priceData } = p
          return {
            ...priceData,
            productId,
            variantId: sku ? variantMap.get(sku) : null
          }
        })
        await tx.insert(priceTiers).values(pricesToInsert)
      }

      // 4. Create Categories
      if (categoryIds.length > 0) {
        await tx.insert(productCategories).values(
          categoryIds.map((categoryId) => ({
            productId,
            categoryId
          }))
        )
      }

      // 5. Create Tags (Handling existence)
      if (tagSlugs.length > 0) {
        for (const slug of tagSlugs) {
          // Check if tag exists
          const existingTag = await tx.query.tags.findFirst({
            where: eq(tags.slug, slug)
          })

          if (!existingTag) {
            await tx.insert(tags).values({ slug, name: slug })
          }
        }

        // Fetch all tag IDs for these slugs
        const allTags = await tx.query.tags.findMany({
          where: inArray(tags.slug, tagSlugs)
        })

        if (allTags.length > 0) {
          await tx.insert(productTags).values(
            allTags.map((t) => ({
              productId,
              tagId: t.id
            }))
          )
        }
      }

      // 6. Create Collections
      if (collectionIds.length > 0) {
        await tx.insert(productCollections).values(
          collectionIds.map((collectionId) => ({
            productId,
            collectionId
          }))
        )
      }

      // 7. Create Images
      if (images.length > 0) {
        const imagesToInsert = images.map((img) => {
          const { variantSku, ...imgData } = img
          return {
            ...imgData,
            productId,
            variantId: variantSku ? variantMap.get(variantSku) : null
          }
        })
        await tx
          .insert(productImages)
          .values(imagesToInsert as (typeof productImages.$inferInsert)[])
      }

      return productId
    })
  }

  async updateWithFullDetails(
    productId: string,
    data: Partial<Omit<typeof products.$inferInsert, "id">> & {
      variants?: (Partial<typeof productVariants.$inferInsert> & { id?: string })[]
      prices?: (Omit<typeof priceTiers.$inferInsert, "productId"> & { sku?: string })[]
      categories?: string[]
      tags?: string[]
      collections?: string[]
      images?: (Partial<typeof productImages.$inferInsert> & { variantSku?: string })[]
    }
  ) {
    const {
      variants,
      prices,
      categories: categoryIds,
      tags: tagSlugs,
      collections: collectionIds,
      images,
      ...productData
    } = data

    return await db.transaction(async (tx) => {
      // 1. Update Product
      if (Object.keys(productData).length > 0) {
        await tx.update(products).set(productData).where(eq(products.id, productId))
      }

      // 2. Sync Variants
      const variantMap = new Map<string, string>() // sku -> id
      if (variants) {
        // Simple approach: Upsert (insert on duplicate key update if supported, or manually)
        for (const variant of variants) {
          const vId = variant.id || createId()
          await tx
            .insert(productVariants)
            .values({ ...variant, id: vId, productId } as typeof productVariants.$inferInsert)
            .onDuplicateKeyUpdate({
              set: {
                name: variant.name,
                sku: variant.sku,
                options: variant.options,
                stock: variant.stock,
                stockManagement: variant.stockManagement,
                image: variant.image
              }
            })
          if (variant.sku) variantMap.set(variant.sku, vId)
        }
      }

      // 3. Sync Prices
      if (prices) {
        // If we don't have variantMap populated (because variants weren't passed), we might need to fetch them
        if (prices.some((p) => p.sku) && variantMap.size === 0) {
          const productVariantsList = await tx.query.productVariants.findMany({
            where: eq(productVariants.productId, productId)
          })
          for (const v of productVariantsList) {
            variantMap.set(v.sku, v.id)
          }
        }

        // Delete old prices and insert new ones
        await tx.delete(priceTiers).where(eq(priceTiers.productId, productId))
        if (prices.length > 0) {
          const pricesToInsert = prices.map((p) => {
            const { sku, ...priceData } = p
            return {
              ...priceData,
              productId,
              variantId: sku ? variantMap.get(sku) : null
            }
          })
          await tx.insert(priceTiers).values(pricesToInsert as (typeof priceTiers.$inferInsert)[])
        }
      }

      // 4. Sync Categories
      if (categoryIds) {
        await tx.delete(productCategories).where(eq(productCategories.productId, productId))
        if (categoryIds.length > 0) {
          await tx.insert(productCategories).values(
            categoryIds.map((categoryId) => ({
              productId,
              categoryId
            }))
          )
        }
      }

      // 5. Sync Tags
      if (tagSlugs) {
        await tx.delete(productTags).where(eq(productTags.productId, productId))
        if (tagSlugs.length > 0) {
          for (const slug of tagSlugs) {
            const existingTag = await tx.query.tags.findFirst({
              where: eq(tags.slug, slug)
            })
            if (!existingTag) {
              await tx.insert(tags).values({ slug, name: slug })
            }
          }
          const allTags = await tx.query.tags.findMany({
            where: inArray(tags.slug, tagSlugs)
          })
          if (allTags.length > 0) {
            await tx.insert(productTags).values(
              allTags.map((t) => ({
                productId,
                tagId: t.id
              }))
            )
          }
        }
      }

      // 6. Sync Collections
      if (collectionIds) {
        await tx.delete(productCollections).where(eq(productCollections.productId, productId))
        if (collectionIds.length > 0) {
          await tx.insert(productCollections).values(
            collectionIds.map((collectionId) => ({
              productId,
              collectionId
            }))
          )
        }
      }

      // 7. Sync Images
      if (images) {
        await tx.delete(productImages).where(eq(productImages.productId, productId))
        if (images.length > 0) {
          const imagesToInsert = images.map((img) => {
            const { variantSku, ...imgData } = img
            return {
              ...imgData,
              productId,
              variantId: variantSku ? variantMap.get(variantSku) : img.variantId || null
            }
          })
          await tx
            .insert(productImages)
            .values(imagesToInsert as (typeof productImages.$inferInsert)[])
        }
      }

      return productId
    })
  }

  async update(id: string, product: Partial<ProductInsert>) {
    return await db.update(products).set(product).where(eq(products.id, id))
  }
  async delete(id: string) {
    return await db.delete(products).where(eq(products.id, id))
  }
  async findAll({ includeInactive = false } = {}) {
    const conditions = []
    if (!includeInactive) conditions.push(eq(products.status, "published"))
    return await db.query.products.findMany({ where: and(...conditions) })
  }

  async findBySlug(slug: string) {
    return await db.query.products.findFirst({
      where: and(eq(products.slug, slug), eq(products.status, "published"))
    })
  }
  /**
   * Obtiene la variante con sus opciones (para mostrar "Rojo / M")
   */
  async findVariantById(variantId: string, { includeProduct = false } = {}) {
    const variant = await db.query.productVariants.findFirst({
      columns: {
        id: true,
        name: true,
        sku: true,
        options: true,
        productId: true
      },
      with: {
        product: includeProduct
          ? {
              columns: {
                id: true,
                name: true,
                sku: true,
                purchaseRules: true,
                status: true
              }
            }
          : undefined
      },
      where: eq(productVariants.id, variantId)
    })

    return variant || null
  }

  /**
   * Obtiene un producto básico por ID (sin relaciones)
   * @param includeInactive - Si true, no filtra por status (para admin)
   * @param includeVariants - Si true, incluye las variantes del producto
   * @param includeImages - Si true, incluye las imágenes del producto
   */
  async findProductById(
    productId: string,
    { includeInactive = false, includeVariants = false, includeImages = false } = {}
  ): Promise<ProductSummary | null> {
    const conditions = [eq(products.id, productId)]
    if (!includeInactive) conditions.push(eq(products.status, "published"))
    if (includeVariants) conditions.push(eq(productVariants.productId, productId))

    const product = await db.query.products.findFirst({
      columns: {
        id: true,
        name: true,
        sku: true,
        purchaseRules: true,
        status: true
      },
      with: {
        images: includeImages
          ? {
              columns: { id: true, url: true, alt: true, isPrimary: true },
              limit: 1,
              orderBy: (img, { desc }) => [desc(img.isPrimary)]
            }
          : undefined,
        variants: includeVariants
          ? {
              columns: {
                id: true,
                name: true,
                sku: true,
                options: true
              }
            }
          : undefined
      },
      where: and(...conditions)
    })

    return product || null
  }

  /**
   * Obtiene un producto con sus relaciones (variantes, imágen principal)
   * @param productId ID del producto
   * @param includeInactive Si true, no filtra por status (para admin)
   * @param allImages Si true, retorna todas las imágenes, si no, solo la principal
   */
  async findProductWithDetails(
    productId: string,
    { includeInactive = false, allImages = false } = {}
  ) {
    const row = await db.query.products.findFirst({
      // columns: {
      //   id: true,
      //   name: true,
      //   sku: true,
      //   purchaseRules: true,
      //   status: true,
      //   badge: true,
      //   code: true,
      //   description: true,
      //   isPricePublic: true,
      //   shortDescription: true,
      //   slug: true,
      //   isFeatured: true
      // },
      with: {
        variants: {
          columns: { id: true, name: true, image: true, sku: true, options: true }
        },
        images: {
          columns: { id: true, url: true, alt: true, isPrimary: true },
          limit: allImages ? undefined : 1,
          orderBy: (img, { desc }) => [desc(img.isPrimary)] // Priorizar primary
        }
      },
      where: and(
        eq(products.id, productId),
        includeInactive ? undefined : eq(products.status, "published")
      )
    })

    if (!row) return null

    const { images, ...product } = row
    return {
      ...product,
      variants: row.variants ?? [],
      primaryImage: images?.[0] ?? null,
      images: allImages ? images : undefined
    }
  }

  /**
   * Producto con precios filtrados por tier + variante opcional
   * Usar para: calcular precio en tiempo real
   */
  async findProductWithPricing({
    productId,
    variantId,
    userTier
  }: {
    productId: string
    variantId?: string | null
    userTier: string
  }) {
    return await db.query.products.findFirst({
      columns: { id: true, name: true, sku: true, purchaseRules: true },
      with: {
        variants: variantId
          ? {
              columns: { id: true, name: true, sku: true },
              where: eq(productVariants.id, variantId)
            }
          : { columns: { id: true, name: true, sku: true } },
        prices: {
          columns: {
            id: true,
            tierType: true,
            price: true,
            compareAtPrice: true,
            minQuantity: true,
            volumeDiscounts: true
          },
          where: and(
            eq(priceTiers.tierType, userTier),
            variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId)
          )
        }
      },
      where: eq(products.id, productId)
    })
  }

  /**
   * Fetch múltiple de productos activos (para snapshot de order)
   * Retorna MAPA: { [productId]: ProductSummary } para lookup O(1)
   */
  async findActiveProductsByIds(productIds: string[]): Promise<Record<string, ProductSummary>> {
    if (productIds.length === 0) return {}

    const rows = await db.query.products.findMany({
      columns: {
        id: true,
        name: true,
        sku: true,
        purchaseRules: true,
        status: true
      },
      with: {
        images: {
          columns: { id: true, url: true, alt: true, isPrimary: true },
          limit: 1,
          orderBy: (img, { desc }) => [desc(img.isPrimary)]
        }
      },
      where: and(inArray(products.id, productIds), eq(products.status, "published"))
    })

    return rows.reduce(
      (acc, row) => {
        acc[row.id] = {
          ...row,
          images: row.images ?? []
        }
        return acc
      },
      {} as Record<string, ProductSummary>
    )
  }

  /**
   * Fetch múltiple de variantes por IDs
   * Retorna MAPA: { [variantId]: VariantSummary } no arrays
   * para crear snapshots de orderItems
   *
   * Antes: [ { id: "a", ... }, { id: "b", ... } ]
   * Ahora: { "a": { id: "a", ... }, "b": { id: "b", ... } }
   * const variant = variantsMap[item.variantId] // Directo, sin .find()
   */
  async findVariantsByIds(variantIds: string[]): Promise<
    Record<
      string,
      {
        id: string
        productId: string
        name: string
        sku: string
        image: string | null
      }
    >
  > {
    if (variantIds.length === 0) return {}

    const results = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        name: productVariants.name,
        sku: productVariants.sku,
        image: productVariants.image
      })
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds))

    return results.reduce(
      (acc, variant) => {
        acc[variant.id] = variant
        return acc
      },
      {} as Record<string, (typeof results)[number]>
    )
  }

  // ─────────────────────────────────────────────────────────
  // Helpers específicos para variantes
  // ─────────────────────────────────────────────────────────

  /**
   * Obtiene variante con datos del producto padre (para validaciones)
   * ej: Cuando necesitás validar que una variante pertenece a un producto publicado.
   * ej: Útil para addOrderItem cuando el admin fuerza una variante específica.
   */
  async findVariantWithProduct(variantId: string) {
    const [result] = await db
      .select({
        variant: {
          id: productVariants.id,
          name: productVariants.name,
          sku: productVariants.sku,
          options: productVariants.options
        },
        product: {
          id: products.id,
          name: products.name,
          sku: products.sku,
          purchaseRules: products.purchaseRules,
          status: products.status
        }
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(productVariants.id, variantId))

    return result ? { ...result.variant, product: result.product } : null
  }
}

export const productsRepository = new ProductsRepository()
