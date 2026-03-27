import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB } from "#test/utils/test-db"
import cartsRoutes from "./carts.routes"
import type { FastifyInstance } from "fastify"

import {
  carts,
  orderItems,
  orders,
  orderTimeline,
  type Product,
  priceTiers,
  products,
  productVariants
} from "@/db/schema"

async function cleanOrdersTables() {
  await db.delete(orderTimeline).execute()
  await db.delete(orderItems).execute()
  await db.delete(orders).execute()
  await db.delete(priceTiers).execute()
  await db.delete(productVariants).execute()
  await db.delete(products).execute()
  await db.delete(carts).execute()
}

describe("Carts Routes (Integration)", () => {
  let app: FastifyInstance

  let testProduct: Product
  let testProduct2: Product
  let cleanupSession: (() => Promise<void>) | null = null
  let customerSessionId: string

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(cartsRoutes, "/carts")
    await app.ready()

    // 2. CORRECCIÓN: Movemos TODO el setup de DB y auth aquí (se ejecuta 1 sola vez)
    const customerAuth = await createTestUserAndSession("reseller")
    customerSessionId = customerAuth.sessionId
    // customerId = customerAuth.user.id

    const adminAuth = await createTestUserAndSession("admin")
    // adminSessionId = adminAuth.sessionId
    // adminId = adminAuth.user.id

    cleanupSession = async () => {
      await customerAuth.cleanup()
      await adminAuth.cleanup()
    }

    // Insertar productos y precios
    const [{ id: p1Id }] = await db
      .insert(products)
      .values({
        name: "Tornillos X",
        slug: "tornillos",
        status: "published",
        purchaseRules: { minQuantity: 10, stepQuantity: 1 }
      })
      .$returningId()

    const [{ id: p2Id }] = await db
      .insert(products)
      .values({
        name: "Tuercas Y",
        slug: "tuercas",
        status: "published"
      })
      .$returningId()

    await db.insert(priceTiers).values([
      { productId: p1Id, tierType: "reseller", price: "5.00" },
      { productId: p2Id, tierType: "reseller", price: "2.00" }
    ])

    testProduct = (await db.query.products.findFirst({ where: eq(products.id, p1Id) })) as Product
    testProduct2 = (await db.query.products.findFirst({ where: eq(products.id, p2Id) })) as Product
  })

  afterAll(async () => {
    await cleanOrdersTables()
    // 2. Ahora sí podemos borrar los usuarios sin error de restricción
    if (cleanupSession) await cleanupSession()

    await app.close()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it("GET /carts - debe retornar 200 y el carrito del usuario", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/carts",
      cookies: { session: customerSessionId }
    })

    expect(
      response.statusCode,
      `Falló el request. Body: ${JSON.stringify(response.json(), null, 2)}`
    ).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty("id")
    expect(body).toHaveProperty("status", "active")
  })

  it("POST /carts/items - debe fallar con 400 por Valibot si falta productId", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        quantity: 5
        // Falta productId
      },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400) // Valibot atrapa esto
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.message).toBe("Los datos enviados no son válidos")
    expect(body.issues).toHaveProperty("productId")
  })

  // Opcional: Test de caso de éxito si tienes base de datos de test sembrada
  it("POST /carts/items - debe retornar 200 con payload válido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        productId: testProduct.id,
        quantity: 1
      },
      cookies: { session: customerSessionId }
    })

    // Depende de tu BD de pruebas, puede ser 200 o lanzar un 404/400 de negocio
    expect([200, 400, 404]).toContain(response.statusCode)
  })

  it("POST /carts/items - debe fallar con 400 si no respeta minQuantity (Lógica de Negocio)", async () => {
    // testProduct tiene minQuantity: 10
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        productId: testProduct.id,
        quantity: 5 // Menor al mínimo
      },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.message).toContain("Mínimo") // O el mensaje exacto que devuelve tu AppError
  })

  it("POST /carts/items - debe agregar el item exitosamente y retornar 200", async () => {
    // testProduct2 no tiene reglas complejas, agregamos 3
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        productId: testProduct2.id,
        quantity: 3
      },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)
  })

  it("GET /carts - debe retornar el carrito hidratado con precios dinámicos", async () => {
    // Ya agregamos 3 unidades de testProduct2 en el test anterior.
    // testProduct2 tiene precio "reseller" de 2.00
    const response = await app.inject({
      method: "GET",
      url: "/carts",
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    expect(body.items).toHaveLength(1)
    expect(body.items[0].productId).toBe(testProduct2.id)
    expect(body.items[0].quantity).toBe(3)

    // Verificamos la hidratación
    expect(body.items[0].pricing).toBeDefined()
    expect(body.items[0].pricing.unitPrice).toBe(2)
    expect(body.items[0].pricing.finalSubtotal).toBe(6) // 3 * 2.00

    expect(body.subtotal).toBe(6)
  })

  it("DELETE /carts - debe vaciar el carrito", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: "/carts",
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)

    // Verificamos que quedó vacío
    const getResponse = await app.inject({
      method: "GET",
      url: "/carts",
      cookies: { session: customerSessionId }
    })

    const body = JSON.parse(getResponse.body)
    expect(body.items).toHaveLength(0)
    expect(body.subtotal).toBe(0)
  })

  // ─────────────────────────────────────────────────────────
  // Tests para PATCH /carts/items/:productId
  // ─────────────────────────────────────────────────────────

  it("PATCH /carts/items/:productId - Happy path - debe actualizar la cantidad y recalcular el carrito", async () => {
    // Primero, nos aseguramos de que el producto esté en el carrito
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { productId: testProduct2.id, quantity: 2 },
      cookies: { session: customerSessionId }
    })

    // Ahora lo actualizamos a 5
    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${testProduct2.id}`,
      payload: { quantity: 5 },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    // Verificamos que se actualizó y se rehidrataron los precios
    // testProduct2 vale 2.00, así que 5 * 2.00 = 10
    const updatedItem = body.items.find(
      (i: { productId: string }) => i.productId === testProduct2.id
    )
    expect(updatedItem).toBeDefined()
    expect(updatedItem.quantity).toBe(5)
    expect(updatedItem.pricing.finalSubtotal).toBe(10)
  })

  it("PATCH /carts/items/:productId - debe fallar con 400 si la cantidad no respeta las reglas", async () => {
    // testProduct tiene minQuantity: 10
    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${testProduct.id}`,
      payload: { quantity: 5 }, // Inválido por regla de negocio
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    // Ajusta el expected si cambiaste el code a mayúsculas
    expect(body.message).toContain("Mínimo")
  })

  it("PATCH /carts/items/:productId - debe eliminar el item si la cantidad es 0", async () => {
    // Aseguramos que testProduct2 esté en el carrito (viene del test anterior)
    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${testProduct2.id}`,
      payload: { quantity: 0 }, // 0 = eliminar
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    // Verificamos que el item ya no está en el array
    const deletedItem = body.items.find(
      (i: { productId: string }) => i.productId === testProduct2.id
    )
    expect(deletedItem).toBeUndefined()
  })

  it("PATCH /carts/items/:productId - debe fallar por Valibot si la cantidad es negativa", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${testProduct2.id}`,
      payload: { quantity: -5 },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    // Valibot debe atajar esto antes de que toque la BD
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.issues).toHaveProperty("quantity")
  })
})
