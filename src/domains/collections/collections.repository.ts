import { and, eq, inArray, sql } from "drizzle-orm"
import type { CreateCollectionInput, UpdateCollectionInput } from "./collections.schema"

import { db } from "@/db"
import { collections, productCollections } from "@/db/pg/products"

// Prepared Statements for better Postgres performance
const findByIdQuery = db.query.collections
  .findFirst({
    where: eq(collections.id, sql.placeholder("id"))
  })
  .prepare("collections_find_by_id")

const findBySlugQuery = db.query.collections
  .findFirst({
    where: eq(collections.slug, sql.placeholder("slug"))
  })
  .prepare("collections_find_by_slug")

export class CollectionsRepository {
  async findAll() {
    return await db.query.collections.findMany({
      orderBy: (collections, { asc }) => [asc(collections.name)]
    })
  }

  async findPublic() {
    return await db.query.collections.findMany({
      where: eq(collections.isActive, true),
      columns: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        isFeatured: true
      },
      orderBy: (collections, { asc }) => [asc(collections.name)]
    })
  }

  async findById(id: string) {
    return await findByIdQuery.execute({ id })
  }

  async findBySlug(slug: string) {
    return await findBySlugQuery.execute({ slug })
  }

  async create(data: CreateCollectionInput) {
    const [inserted] = await db.insert(collections).values(data).returning()
    return inserted
  }

  async update(id: string, data: UpdateCollectionInput) {
    const [updated] = await db
      .update(collections)
      .set(data)
      .where(eq(collections.id, id))
      .returning()
    return updated
  }

  async delete(id: string) {
    return await db.delete(collections).where(eq(collections.id, id))
  }

  /**
   * Bulk assign products to one or more collections
   */
  async assignProducts(productIds: string[], collectionIds: string[]) {
    const values: (typeof productCollections.$inferInsert)[] = []

    for (const productId of productIds) {
      for (const collectionId of collectionIds) {
        values.push({
          productId,
          collectionId
        })
      }
    }

    if (values.length === 0) return

    await db.insert(productCollections).values(values).onConflictDoNothing() // En Postgres si ya existe la relación, no hacemos nada
  }

  /**
   * Remove products from one or more collections
   */
  async unassignProducts(productIds: string[], collectionIds: string[]) {
    await db
      .delete(productCollections)
      .where(
        and(
          inArray(productCollections.productId, productIds),
          inArray(productCollections.collectionId, collectionIds)
        )
      )
  }
}

export const collectionsRepository = new CollectionsRepository()
