import { and, eq, inArray } from "drizzle-orm"
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema"

import { db } from "@/db"
import { categories, productCategories } from "@/db/schema/products"

export class CategoriesRepository {
  async findAll() {
    return await db.query.categories.findMany({
      orderBy: (categories, { asc }) => [asc(categories.name)]
    })
  }

  async findPublic() {
    return await db.query.categories.findMany({
      columns: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        imageUrl: true
      },
      orderBy: (categories, { asc }) => [asc(categories.name)]
    })
  }

  async findById(id: string) {
    return await db.query.categories.findFirst({
      where: eq(categories.id, id)
    })
  }

  async findBySlug(slug: string) {
    return await db.query.categories.findFirst({
      where: eq(categories.slug, slug)
    })
  }

  async create(data: CreateCategoryInput) {
    await db.insert(categories).values(data)
    return await this.findBySlug(data.slug)
  }

  async update(id: string, data: UpdateCategoryInput) {
    await db.update(categories).set(data).where(eq(categories.id, id))
    return await this.findById(id)
  }

  async delete(id: string) {
    return await db.delete(categories).where(eq(categories.id, id))
  }

  /**
   * Bulk assign products to one or more categories
   */
  async assignProducts(productIds: string[], categoryIds: string[], isPrimary = false) {
    const values: (typeof productCategories.$inferInsert)[] = []

    for (const productId of productIds) {
      for (const categoryId of categoryIds) {
        values.push({
          productId,
          categoryId,
          isPrimary
        })
      }
    }

    if (values.length === 0) return

    // Using insert ignore or upsert to avoid duplicates as product_categories has a PK on (productId, categoryId)
    // Drizzle on MySQL: ON DUPLICATE KEY UPDATE isPrimary = VALUES(isPrimary)
    await db
      .insert(productCategories)
      .values(values)
      .onDuplicateKeyUpdate({
        set: { isPrimary: isPrimary }
      })
  }

  /**
   * Remove products from one or more categories
   */
  async unassignProducts(productIds: string[], categoryIds: string[]) {
    await db
      .delete(productCategories)
      .where(
        and(
          inArray(productCategories.productId, productIds),
          inArray(productCategories.categoryId, categoryIds)
        )
      )
  }
}

export const categoriesRepository = new CategoriesRepository()
