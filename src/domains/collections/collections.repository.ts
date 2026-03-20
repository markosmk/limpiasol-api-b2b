import { and, eq, inArray, sql } from "drizzle-orm"
import type { CreateCollectionInput, UpdateCollectionInput } from "./collections.schema"

import { db } from "@/db"
import { collections, productCollections } from "@/db/schema/products"

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
    return await db.query.collections.findFirst({
      where: eq(collections.id, id)
    })
  }

  async findBySlug(slug: string) {
    return await db.query.collections.findFirst({
      where: eq(collections.slug, slug)
    })
  }

  async create(data: CreateCollectionInput) {
    await db.insert(collections).values(data)
    return await this.findBySlug(data.slug)
  }

  async update(id: string, data: UpdateCollectionInput) {
    await db.update(collections).set(data).where(eq(collections.id, id))
    return await this.findById(id)
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

    await db
      .insert(productCollections)
      .values(values)
      .onDuplicateKeyUpdate({
        set: { productId: sql`product_id` }
      })
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
