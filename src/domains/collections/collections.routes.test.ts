/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB, teardownTestDB } from "#test/utils/test-db"
import collectionsRoutes from "./collections.routes"
import type { FastifyInstance } from "fastify"

import { collections, productCollections, products } from "@/db/pg/products"

describe("Collections Domain", () => {
  let app: FastifyInstance
  let adminSessionId: string
  let customerSessionId: string
  let cleanupSessions: (() => Promise<void>) | null = null

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(collectionsRoutes, "/collections")
    await app.ready()
  })

  afterAll(async () => {
    if (cleanupSessions) await cleanupSessions()
    await app.close()
    await teardownTestDB()
  })

  beforeEach(async () => {
    // Clear tables
    await db.delete(productCollections).execute()
    await db.delete(products).execute()
    await db.delete(collections).execute()

    if (!adminSessionId) {
      const adminAuth = await createTestUserAndSession("admin")
      const customerAuth = await createTestUserAndSession("user")
      adminSessionId = adminAuth.sessionId
      customerSessionId = customerAuth.sessionId

      cleanupSessions = async () => {
        await adminAuth.cleanup()
        await customerAuth.cleanup()
      }
    }
  })

  describe("Public Routes", () => {
    it("Debe devolver las colecciones publicas", async () => {
      await db
        .insert(collections)
        .values({ name: "Verano", slug: "verano", isActive: true })
        .execute()

      const res = await app.inject({ method: "GET", url: "/collections" })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.data.collections.length).toBeGreaterThan(0)
      expect(body.data.collections[0].name).toBe("Verano")
    })

    it("Debe devolver una coleccion por slug", async () => {
      await db
        .insert(collections)
        .values({ name: "Invierno", slug: "invierno", isActive: true })
        .execute()

      const res = await app.inject({ method: "GET", url: "/collections/slug/invierno" })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.collection.name).toBe("Invierno")
    })
  })

  describe("Admin Routes", () => {
    it("Debe denegar creacion a usuario no admin (401 o 403)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/collections/admin",
        payload: { collection: { name: "Nueva", slug: "nueva" } },
        cookies: { session: customerSessionId }
      })
      expect(res.statusCode).toBeGreaterThanOrEqual(401)
    })

    it("Debe permitir crear coleccion a admin y hacerla visible publicamente", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/collections/admin",
        payload: { collection: { name: "Otoño", slug: "otono", isActive: true } },
        cookies: { session: adminSessionId }
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.collection.name).toBe("Otoño")

      // Verify it shows up in public endpoint
      const publicRes = await app.inject({ method: "GET", url: "/collections" })
      const publicBody = publicRes.json()
      expect(publicBody.data.collections.some((c: any) => c.name === "Otoño")).toBe(true)
    })

    it("Debe permitir actualizar una coleccion", async () => {
      const inserted = await db
        .insert(collections)
        .values({ name: "Vieja", slug: "vieja" })
        .returning()
      const collectionId = inserted[0].id

      const res = await app.inject({
        method: "PUT",
        url: `/collections/admin/${collectionId}`,
        payload: { collection: { name: "Actualizada", slug: "actualizada" } },
        cookies: { session: adminSessionId }
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.collection.name).toBe("Actualizada")
    })

    it("Debe permitir borrar una coleccion", async () => {
      const inserted = await db
        .insert(collections)
        .values({ name: "Borrar", slug: "borrar" })
        .returning()
      const collectionId = inserted[0].id

      const res = await app.inject({
        method: "DELETE",
        url: `/collections/admin/${collectionId}`,
        cookies: { session: adminSessionId }
      })
      expect(res.statusCode).toBe(200)

      const checkRes = await app.inject({ method: "GET", url: `/collections/slug/borrar` })
      expect(checkRes.statusCode).toBe(404)
    })

    it("Debe permitir bulk-assign de productos a colecciones", async () => {
      const col = await db.insert(collections).values({ name: "Promo", slug: "promo" }).returning()
      const prod = await db.insert(products).values({ name: "Prod1", slug: "prod1" }).returning()

      const res = await app.inject({
        method: "POST",
        url: "/collections/admin/bulk-assign",
        payload: {
          productIds: [prod[0].id],
          collectionIds: [col[0].id]
        },
        cookies: { session: adminSessionId }
      })

      expect(res.statusCode).toBe(200)

      // Verify DB relationship
      const relations = await db.query.productCollections.findMany()
      expect(relations.length).toBe(1)
      expect(relations[0].productId).toBe(prod[0].id)
      expect(relations[0].collectionId).toBe(col[0].id)
    })
  })
})
