import { and, eq, inArray, sql } from "drizzle-orm"
import type { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema"

import { db } from "@/db"
import { categories, productCategories } from "@/db/pg/products"

// Prepared Statements for better Postgres performance
const findByIdQuery = db.query.categories
  .findFirst({
    where: eq(categories.id, sql.placeholder("id"))
  })
  .prepare("categories_find_by_id")

const findBySlugQuery = db.query.categories
  .findFirst({
    where: eq(categories.slug, sql.placeholder("slug"))
  })
  .prepare("categories_find_by_slug")

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
    return await findByIdQuery.execute({ id })
  }

  async findBySlug(slug: string) {
    return await findBySlugQuery.execute({ slug })
  }

  async create(data: CreateCategoryInput) {
    // Postgres supports native RETURNING, which avoids a second SELECT query!
    const [inserted] = await db.insert(categories).values(data).returning()
    return inserted
  }

  async update(id: string, data: UpdateCategoryInput) {
    // Native RETURNING on update
    const [updated] = await db.update(categories).set(data).where(eq(categories.id, id)).returning()
    return updated
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

    // In Postgres we use onConflictDoUpdate for upserts
    await db
      .insert(productCategories)
      .values(values)
      .onConflictDoUpdate({
        target: [productCategories.productId, productCategories.categoryId],
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
