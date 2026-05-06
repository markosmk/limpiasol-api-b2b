import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB, teardownTestDB } from "#test/utils/test-db"
import categoriesRoutes from "./categories.routes"
import type { FastifyInstance } from "fastify"

import { categories, productCategories, products } from "@/db/pg/products"

describe("Categories Domain", () => {
  let app: FastifyInstance
  let adminSessionId: string
  let customerSessionId: string
  let cleanupSessions: (() => Promise<void>) | null = null

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(categoriesRoutes, "/categories")
    await app.ready()
  })

  afterAll(async () => {
    if (cleanupSessions) await cleanupSessions()
    await app.close()
    await teardownTestDB()
  })

  beforeEach(async () => {
    // Clear tables
    await db.delete(productCategories).execute()
    await db.delete(products).execute()
    await db.delete(categories).execute()

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
    it("Debe devolver las categorias publicas", async () => {
      await db.insert(categories).values({ name: "Limpieza", slug: "limpieza" }).execute()

      const res = await app.inject({ method: "GET", url: "/categories" })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.success).toBe(true)
      expect(body.data.categories.length).toBeGreaterThan(0)
      expect(body.data.categories[0].name).toBe("Limpieza")
    })

    it("Debe devolver una categoria por slug", async () => {
      await db.insert(categories).values({ name: "Hogar", slug: "hogar" }).execute()

      const res = await app.inject({ method: "GET", url: "/categories/hogar" })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.category.name).toBe("Hogar")
    })
  })

  describe("Admin Routes", () => {
    it("Debe denegar creacion a usuario no admin (401 o 403)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/categories/admin",
        payload: { category: { name: "Nueva", slug: "nueva" } },
        cookies: { session: customerSessionId }
      })
      expect(res.statusCode).toBeGreaterThanOrEqual(401)
    })

    it("Debe permitir crear categoria a admin y hacerla visible publicamente", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/categories/admin",
        payload: { category: { name: "Cocina", slug: "cocina" } },
        cookies: { session: adminSessionId }
      })

      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.category.name).toBe("Cocina")

      // Verify it shows up in public endpoint
      const publicRes = await app.inject({ method: "GET", url: "/categories" })
      const publicBody = publicRes.json()
      // biome-ignore lint/suspicious/noExplicitAny: <explanation >
      expect(publicBody.data.categories.some((c: any) => c.name === "Cocina")).toBe(true)
    })

    it("Debe permitir actualizar una categoria", async () => {
      const inserted = await db
        .insert(categories)
        .values({ name: "Vieja", slug: "vieja" })
        .returning()
      const categoryId = inserted[0].id

      const res = await app.inject({
        method: "PUT",
        url: `/categories/admin/${categoryId}`,
        payload: { category: { name: "Actualizada", slug: "actualizada" } },
        cookies: { session: adminSessionId }
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.category.name).toBe("Actualizada")
    })

    it("Debe permitir borrar una categoria", async () => {
      const inserted = await db
        .insert(categories)
        .values({ name: "Borrar", slug: "borrar" })
        .returning()
      const categoryId = inserted[0].id

      const res = await app.inject({
        method: "DELETE",
        url: `/categories/admin/${categoryId}`,
        cookies: { session: adminSessionId }
      })
      expect(res.statusCode).toBe(200)

      const checkRes = await app.inject({ method: "GET", url: `/categories/borrar` })
      expect(checkRes.statusCode).toBe(404)
    })

    it("Debe permitir bulk-assign de productos a categorias", async () => {
      const cat = await db.insert(categories).values({ name: "Promo", slug: "promo" }).returning()
      const prod = await db.insert(products).values({ name: "Prod1", slug: "prod1" }).returning()

      const res = await app.inject({
        method: "POST",
        url: "/categories/admin/bulk-assign",
        payload: {
          productIds: [prod[0].id],
          categoryIds: [cat[0].id],
          isPrimary: true
        },
        cookies: { session: adminSessionId }
      })

      expect(res.statusCode).toBe(200)

      // Verify DB relationship
      const relations = await db.query.productCategories.findMany()
      expect(relations.length).toBe(1)
      expect(relations[0].productId).toBe(prod[0].id)
      expect(relations[0].categoryId).toBe(cat[0].id)
      expect(relations[0].isPrimary).toBe(true)
    })
  })
})
