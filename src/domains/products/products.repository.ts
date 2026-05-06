import { createId } from "@paralleldrive/cuid2"
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import type {
  PriceTierInsert,
  Product,
  ProductImageInsert,
  ProductInsert,
  ProductVariantInsert
} from "@/db/pg/products"
import type { PurchaseRule } from "@/db/pg/products.types"
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
} from "@/db/pg"

// Prepared Statement para la consulta más frecuente del catálogo: buscar producto por slug
const findProductBySlugQuery = db.query.products
  .findFirst({
    columns: {
      id: true,
      name: true,
      slug: true,
      code: true,
      description: true,
      shortDescription: true,
      badge: true
    },
    where: and(eq(products.slug, sql.placeholder("slug")), eq(products.status, "published")),
    with: {
      images: {
        columns: { id: true, url: true, alt: true, isPrimary: true },
        limit: 1,
        orderBy: (img, { desc }) => [desc(img.isPrimary)]
      },
      variants: {
        columns: {
          id: true,
          name: true,
          sku: true,
          options: true,
          stock: true,
          stockManagement: true,
          image: true
        }
      },
      categories: {
        columns: { categoryId: true },
        with: {
          category: {
            columns: { id: true, name: true, slug: true }
          }
        }
      },
      tags: {
        columns: { tagId: true },
        with: {
          tag: {
            columns: { id: true, name: true, slug: true }
          }
        }
      },
      collections: {
        columns: { collectionId: true },
        with: {
          collection: {
            columns: { id: true, name: true, slug: true, isActive: true }
          }
        }
      }
    }
  })
  .prepare("products_find_by_slug")

type CreateProductInput = {
  product: ProductInsert
  variants: Omit<ProductVariantInsert, "productId">[]
  prices: (Omit<PriceTierInsert, "productId"> & { variantSku?: string })[]
  categories?: string[]
  tags?: string[]
  collections?: string[]
  images?: (Omit<ProductImageInsert, "productId"> & { variantSku?: string })[]
}

type UpdateProductInput = {
  product: Partial<Omit<ProductInsert, "id">>
  variants?: Partial<ProductVariantInsert>[]
  prices?: (Omit<PriceTierInsert, "productId"> & { variantSku?: string })[]
  categories?: string[]
  tags?: string[]
  collections?: string[]
  images?: (Partial<ProductImageInsert> & { variantSku?: string })[]
}

export class ProductsRepository {
  constructor(private readonly database: typeof db = db) {}

  // TODO add filters
  async getCatalogProducts(page = 1, limit = 20) {
    const offset = (page - 1) * limit

    return await this.database.query.products.findMany({
      where: eq(products.status, "published"),
      orderBy: [desc(products.createdAt)], // new first
      limit,
      offset,
      with: {
        images: {
          columns: { url: true },
          orderBy: [asc(productImages.isPrimary)]
        },
        variants: {
          columns: { id: true, image: true }
        }
      }
    })
  }

  async createWithFullDetails(dataInput: CreateProductInput) {
    const {
      product: productData,
      variants = [],
      prices = [],
      categories: categoryIds = [],
      tags: tagSlugs = [],
      collections: collectionIds = [],
      images = []
    } = dataInput

    return await db.transaction(async (tx) => {
      // 1. Create Product
      const productId = productData.id || createId()
      await tx.insert(products).values({ ...productData, id: productId })

      // 2. Create Variants
      const variantMap = new Map<string, string>() // sku -> id
      for (const variant of variants) {
        const vId = variant.id || createId()
        await tx.insert(productVariants).values({ ...variant, id: vId, productId })
        variantMap.set(variant.sku, vId)
      }

      // 3. Create Prices
      if (prices.length > 0) {
        const pricesToInsert = prices.map((p) => {
          const { variantSku, ...priceData } = p
          return {
            ...priceData,
            productId,
            variantId: variantSku ? variantMap.get(variantSku) : null
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

  async updateWithFullDetails(productId: string, data: UpdateProductInput) {
    const {
      product: productData,
      variants,
      prices,
      categories: categoryIds,
      tags: tagSlugs,
      collections: collectionIds,
      images
    } = data

    return await db.transaction(async (tx) => {
      // 1. Update Product
      if (Object.keys(productData).length > 0) {
        await tx.update(products).set(productData).where(eq(products.id, productId))
      }

      // 2. Sync Variants
      const variantMap = new Map<string, string>() // sku -> id
      if (variants) {
        // A. Obtener IDs de las variantes actuales en la DB
        const existingVariants = await tx.query.productVariants.findMany({
          where: eq(productVariants.productId, productId),
          columns: { id: true, sku: true }
        })

        // B. Identificar qué variantes mandó el frontend para mantener/crear
        const inputVariantIds = variants.filter((v) => v.id).map((v) => v.id!)

        // C. Borrar las variantes que están en DB pero NO vinieron en el input
        const variantsToDelete = existingVariants.filter((v) => !inputVariantIds.includes(v.id))
        if (variantsToDelete.length > 0) {
          await tx.delete(productVariants).where(
            inArray(
              productVariants.id,
              variantsToDelete.map((v) => v.id)
            )
          )
        }

        // D. Hacer Upsert de las variantes que llegaron
        // Simple approach: Upsert (insert on duplicate key update if supported, or manually)
        for (const variant of variants) {
          const vId = variant.id || createId()

          // Si es una creación, requerimos campos obligatorios (sku, name, options)
          // Asumimos que el schema de validación ya forzó esto.
          await tx
            .insert(productVariants)
            .values({
              ...variant,
              id: vId,
              productId,
              // Proveer defaults seguros si faltan en un insert
              sku: variant.sku || `SKU-${vId.slice(0, 8)}`,
              name: variant.name || "Única",
              options: variant.options || {}
            })
            .onConflictDoUpdate({
              target: [productVariants.id],
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
      } else {
        // Si no mandaron variants, igual necesitamos llenar el variantMap
        // por si están actualizando prices/images que dependen del SKU.
        if (prices?.some((p) => p.variantSku) || images?.some((i) => i.variantSku)) {
          const currentVariants = await tx.query.productVariants.findMany({
            where: eq(productVariants.productId, productId)
          })
          for (const v of currentVariants) {
            variantMap.set(v.sku, v.id)
          }
        }
      }

      // 3. Sync Prices
      if (prices) {
        // Delete old prices and insert new ones
        await tx.delete(priceTiers).where(eq(priceTiers.productId, productId))
        if (prices.length > 0) {
          const pricesToInsert = prices.map((p) => {
            const { variantSku, ...priceData } = p
            return {
              ...priceData,
              productId,
              variantId: variantSku ? variantMap.get(variantSku) : null
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
          await tx.insert(productImages).values(imagesToInsert as ProductImageInsert[]) // TODO testear
        }
      }

      return productId
    })
  }

  async delete(id: string) {
    return await db.delete(products).where(eq(products.id, id))
  }

  async findAll() {
    return await db.query.products.findMany({
      columns: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        images: {
          columns: { id: true, url: true, alt: true, isPrimary: true },
          limit: 1,
          orderBy: (img, { desc }) => [desc(img.isPrimary)]
        },
        variants: {
          columns: {
            id: true,
            name: true,
            sku: true,
            options: true,
            stock: true,
            stockManagement: true,
            image: true
          }
        },
        categories: {
          columns: { categoryId: true },
          with: {
            category: {
              columns: { id: true, name: true, slug: true }
            }
          }
        }
      }
    })
  }

  async findBySlug(slug: string) {
    const product = await findProductBySlugQuery.execute({ slug })

    if (!product) return null

    // Filter out inactive collections
    const activeCollections = product.collections.filter((pc) => pc.collection.isActive)

    return {
      ...product,
      collections: activeCollections
    }
  }

  /**
   * Fast query to check multiple properties of a product
   */
  async findProductChecking(productId: string, properties: (keyof Product)[]) {
    return await db.query.products.findFirst({
      columns: { id: true },
      where: and(eq(products.id, productId), ...properties.map((prop) => eq(products[prop], true)))
    })
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
      columns: { id: true, name: true, purchaseRules: true },
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
   * Obtiene variantes y su producto padre en una sola consulta.
   * Retorna MAPA: { [variantId]: VariantWithProduct }
   */
  async findVariantsWithProductParent(variantIds: string[]) {
    if (variantIds.length === 0) return {}

    const results = await db.query.productVariants.findMany({
      where: inArray(productVariants.id, variantIds),
      with: {
        product: {
          columns: {
            id: true,
            name: true,
            purchaseRules: true
            // agregar cualquier otra columna del producto que se necesite en la orden
          },
          with: {
            images: {
              columns: { id: true, url: true, isPrimary: true },
              limit: 1,
              orderBy: (img, { desc }) => [desc(img.isPrimary)]
            }
          }
        }
      }
    })

    // Convertimos el array en un Record para lookup O(1)
    return results.reduce(
      (acc, variant) => {
        acc[variant.id] = variant
        return acc
      },
      {} as Record<string, (typeof results)[number]>
    )
  }

  /**
   * Fetch múltiple de productos activos (para snapshot de order)
   * Retorna MAPA: { [productId]: ProductSummary } para lookup O(1)
   */
  // async findActiveProductsByIds(productIds: string[]): Promise<Record<string, ProductSummary>> {
  //   if (productIds.length === 0) return {}

  //   const rows = await db.query.products.findMany({
  //     columns: {
  //       id: true,
  //       name: true,
  //       purchaseRules: true,
  //       status: true
  //     },
  //     with: {
  //       images: {
  //         columns: { id: true, url: true, alt: true, isPrimary: true },
  //         limit: 1,
  //         orderBy: (img, { desc }) => [desc(img.isPrimary)]
  //       }
  //     },
  //     where: and(inArray(products.id, productIds), eq(products.status, "published"))
  //   })

  //   return rows.reduce(
  //     (acc, row) => {
  //       acc[row.id] = {
  //         ...row,
  //         images: row.images ?? []
  //       }
  //       return acc
  //     },
  //     {} as Record<string, ProductSummary>
  //   )
  // }

  /**
   * Fetch múltiple de variantes por IDs
   * Retorna MAPA: { [variantId]: VariantSummary } no arrays
   * para crear snapshots de orderItems
   *
   * Antes: [ { id: "a", ... }, { id: "b", ... } ]
   * Ahora: { "a": { id: "a", ... }, "b": { id: "b", ... } }
   * const variant = variantsMap[item.variantId] // Directo, sin .find()
   */
  // async findVariantsByIds(variantIds: string[]): Promise<
  //   Record<
  //     string,
  //     {
  //       id: string
  //       productId: string
  //       name: string
  //       sku: string
  //       image: string | null
  //     }
  //   >
  // > {
  //   if (variantIds.length === 0) return {}

  //   const results = await db
  //     .select({
  //       id: productVariants.id,
  //       productId: productVariants.productId,
  //       name: productVariants.name,
  //       sku: productVariants.sku,
  //       image: productVariants.image
  //     })
  //     .from(productVariants)
  //     .where(inArray(productVariants.id, variantIds))

  //   return results.reduce(
  //     (acc, variant) => {
  //       acc[variant.id] = variant
  //       return acc
  //     },
  //     {} as Record<string, (typeof results)[number]>
  //   )
  // }

  // ─────────────────────────────────────────────────────────
  // Helpers específicos para variantes
  // ─────────────────────────────────────────────────────────

  /**
   * Obtiene variante con datos del producto padre (para validaciones)
   * ej: Cuando se necesita validar que una variante pertenece a un producto publicado.
   * ej: Útil para addOrderItem cuando el admin fuerza una variante específica.
   */
  async findVariantWithProduct(variantId: string) {
    const variant = await this.database.query.productVariants.findFirst({
      columns: {
        id: true,
        name: true,
        sku: true,
        options: true
      },
      with: {
        product: {
          columns: {
            id: true,
            name: true,
            purchaseRules: true,
            status: true
          }
        }
      },
      where: eq(productVariants.id, variantId)
    })

    return variant
  }

  /**
   * Obtiene las reglas de compra del producto o variante
   * Útil para calcular precios dinámicos.
   * Jerarquía:
   * 1. Reglas por tier (no implementado)
   * 2. Reglas de la variante
   * 3. Reglas del producto
   * 4. Reglas por defecto
   */
  async getResolvedPurchaseRules(productId: string, variantId: string | null): Promise<PurchaseRule | null> {
    let productRules: PurchaseRule | null = null
    let variantRules: PurchaseRule | null = null

    if (variantId) {
      // 1. variante con su producto padre
      const variant = await this.database.query.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
        columns: { purchaseRules: true },
        with: {
          product: {
            columns: { id: true, purchaseRules: true, status: true }
          }
        }
      })
      if (!variant || variant.product?.status !== "published") return null

      productRules = variant.product?.purchaseRules || null
      variantRules = variant.purchaseRules || null
    } else {
      // Solo el producto
      const product = await this.database.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.status, "published")),
        columns: { purchaseRules: true }
      })
      if (!product) return null

      productRules = product.purchaseRules || null
    }

    // 2. reglas por defecto base
    const defaultRules: PurchaseRule = {
      minQuantity: 1,
      maxQuantity: undefined,
      stepQuantity: 1,
      unitName: "unidades"
    }

    // 3. Fusion: Default se pisa con Producto, Producto se pisa con Variante
    return {
      ...defaultRules,
      ...(productRules || {}),
      ...(variantRules || {})
    }
  }
}

export const productsRepository = new ProductsRepository()
