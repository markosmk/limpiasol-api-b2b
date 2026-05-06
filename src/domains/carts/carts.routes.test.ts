import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestProductWithVariant } from "#test/utils/db-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB } from "#test/utils/test-db"
import cartsRoutes from "./carts.routes"
import type { FastifyInstance } from "fastify"

import {
  carts,
  orderItems,
  orders,
  orderTimeline,
  priceTiers,
  products,
  productVariants
} from "@/db/pg"

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

  // Ahora solo guardamos los IDs que necesitamos
  let p1: { productId: string; variantId: string } // Producto con reglas base
  let p2: { productId: string; variantId: string } // Producto con step y min
  let p3: { productId: string; variantId: string } // Producto con herencia de variante

  let cleanupSession: (() => Promise<void>) | null = null
  let customerSessionId: string
  let customerId: string

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(cartsRoutes, "/carts")
    await app.ready()

    const customerAuth = await createTestUserAndSession("reseller")
    customerSessionId = customerAuth.sessionId
    customerId = customerAuth.user.id

    const adminAuth = await createTestUserAndSession("admin")

    cleanupSession = async () => {
      await customerAuth.cleanup()
      await adminAuth.cleanup()
    }

    // 1. Producto normal, precio 5.00
    p1 = await createTestProductWithVariant({
      name: "Tornillos X",
      slug: "tornillos",
      price: "5.00",
      tierType: "reseller"
    })

    // 2. Producto con min 6 y step 2, precio 2.00
    p2 = await createTestProductWithVariant({
      name: "Tuercas Y",
      slug: "tuercas",
      productRules: { minQuantity: 6, maxQuantity: 20, stepQuantity: 2 },
      price: "2.00",
      tierType: "reseller"
    })

    // 3. Producto para testear herencia (Producto min 10, Variante min 20), precio 10.00
    p3 = await createTestProductWithVariant({
      name: "Clavos Z",
      slug: "clavos",
      productRules: { minQuantity: 10, stepQuantity: 1 },
      variantRules: { minQuantity: 20, stepQuantity: 1 },
      price: "10.00",
      tierType: "reseller"
    })
  })

  afterAll(async () => {
    await cleanOrdersTables()
    if (cleanupSession) await cleanupSession()
    await app.close()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    // limpiar carrito despues de cada test para asegurar independencia.
    await db.delete(carts).where(eq(carts.userId, customerId)).execute()
  })

  it("GET /carts - debe retornar 200 y crea/retornar el carrito del usuario", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/carts",
      cookies: { session: customerSessionId }
    })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty("id")
    expect(body).toHaveProperty("status", "active")
    expect(body.items).toHaveLength(0)
  })

  it("POST /carts/items - debe fallar con 400 por Valibot si falta variantId", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        quantity: 5
        // Falta variantId
      },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400) // Valibot atrapa esto
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.message).toBe("Los datos enviados no son válidos")
    expect(body.issues).toHaveProperty("variantId")
  })

  // --- TESTS DE REGLAS DE NEGOCIO (PURCHASE RULES) ---

  it("POST /carts/items - debe retornar 200 con payload válido", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        variantId: p2.variantId,
        quantity: 4 // p2 requiere min 6
      },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_RULES")
    expect(body.message).toContain("Mínimo")
  })

  it("POST /carts/items - debe fallar con 400 si no respeta minQuantity (Lógica de Negocio)", async () => {
    // testProduct2 tiene minQuantity: 6 en su purchaseRules (varian2 no tiene purchaseRules)
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        variantId: p2.variantId,
        quantity: 7 // p2 requiere min 6, pero step 2 (debe ser 6, 8, 10...)
      },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_RULES")
    expect(body.message).toContain("múltiplo") // O la palabra que en AppError
  })

  it("POST /carts/items - debe validar las reglas de la variante sobre las del producto", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p3.variantId, quantity: 15 }, // p3 base min 10, pero variante min 20
      cookies: { session: customerSessionId }
    })
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body).message).toContain("Mínimo")
  })

  it("POST /carts/items - debe agregar el item exitosamente si cumple las reglas", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: {
        variantId: p2.variantId,
        quantity: 8 // Cumple min 6 y step 2
      },
      cookies: { session: customerSessionId }
    })
    expect(response.statusCode).toBe(200)
  })

  it("POST /carts/items - debe fallar si el producto no está publicado (Draft)", async () => {
    // Creamos un producto en draft manualmente
    const [{ id: draftProdId }] = await db
      .insert(products)
      .values({
        name: "Producto Borrador",
        slug: "draft-product",
        status: "draft"
      })
      .returning({ id: products.id })

    const [{ id: draftVarId }] = await db
      .insert(productVariants)
      .values({
        id: "ncx076a086y692a7y9999999", // cuid2 valid
        productId: draftProdId,
        sku: "DRAFT-SKU",
        name: "Default",
        options: { color: "borrador" }
      })
      .returning({ id: productVariants.id })

    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: draftVarId, quantity: 1 },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_RULES")
    expect(body.message).toContain("encontrada")
  })

  it("POST /carts/items - debe sumar cantidades y validar el total contra maxQuantity", async () => {
    // p2 tiene maxQuantity: 20
    // 1. Agregamos 10 (ok)
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p2.variantId, quantity: 10 },
      cookies: { session: customerSessionId }
    })

    // 2. Intentamos agregar 11 más (Total 21 > 20) -> debe fallar
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p2.variantId, quantity: 11 },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_RULES")
    expect(body.message).toContain("Máximo")
  })

  it("POST /carts/items - debe fallar si la variante no existe", async () => {
    const validCuid2 = "ncx076a086y692a7y1234567" // Formato válido para Valibot
    const response = await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: validCuid2, quantity: 1 },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.body).message).toContain("encontrada")
  })

  // --- TESTS DE HIDRATACIÓN ---

  it("GET /carts - debe retornar el carrito hidratado con precios dinámicos", async () => {
    // 1. PREPARAMOS EL ESTADO: Agregamos el ítem primero
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p2.variantId, quantity: 6 }, // Precio $2.00, Total $12.00
      cookies: { session: customerSessionId }
    })

    // 2. EJECUTAMOS LA ACCIÓN A TESTEAR
    const response = await app.inject({
      method: "GET",
      url: "/carts",
      cookies: { session: customerSessionId }
    })

    // 3. VERIFICAMOS
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    expect(body.items).toHaveLength(1)
    expect(body.items[0].variantId).toBe(p2.variantId)
    expect(body.items[0].quantity).toBe(6)

    expect(body.items[0].pricing).toBeDefined()
    expect(body.items[0].pricing.unitPrice).toBe(2)
    expect(body.items[0].pricing.finalSubtotal).toBe(12) // 6 * 2.00

    expect(body.subtotal).toBe(12)
  })

  // --- TESTS DE PATCH ---

  it("PATCH /carts/items/:variantId - Happy path - debe actualizar la cantidad y recalcular el carrito", async () => {
    // 1. Estado inicial
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p1.variantId, quantity: 1 }, // p1 no tiene reglas estrictas
      cookies: { session: customerSessionId }
    })

    // 2. Modificamos
    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${p1.variantId}`,
      payload: { quantity: 5 }, // 5 * $5.00 = $25.00
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)

    const updatedItem = body.items.find((i: { variantId: string }) => i.variantId === p1.variantId)
    expect(updatedItem).toBeDefined()
    expect(updatedItem.quantity).toBe(5)
    expect(updatedItem.pricing.finalSubtotal).toBe(25)
  })

  it("PATCH /carts/items/:variantId - debe eliminar el item si la cantidad es 0", async () => {
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p1.variantId, quantity: 1 },
      cookies: { session: customerSessionId }
    })

    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${p1.variantId}`,
      payload: { quantity: 0 }, // 0 = eliminar
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(200)

    // Verificamos que el item ya no está en el array
    const deletedItem = JSON.parse(response.body).items.find(
      (i: { variantId: string }) => i.variantId === p1.variantId
    )
    expect(deletedItem).toBeUndefined()
  })

  it("PATCH /carts/items/:variantId - debe fallar con 400 si la cantidad no respeta las reglas", async () => {
    // creamos carrito
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p2.variantId, quantity: 10 },
      cookies: { session: customerSessionId }
    })

    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${p2.variantId}`,
      payload: { quantity: 5 }, // Inválido por regla de negocio, product tiene minQuantity: 6 en purchaseRules
      cookies: { session: customerSessionId }
    })

    expect(
      response.statusCode,
      `Status code should be 400 but got ${JSON.stringify(response.body)}`
    ).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_RULES")
    expect(body.message).toContain("Mínimo")
  })

  it("PATCH /carts/items/:variantId - debe fallar con 400 si la cantidad excede las reglas", async () => {
    // creamos carrito
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p2.variantId, quantity: 10 },
      cookies: { session: customerSessionId }
    })

    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${p2.variantId}`,
      payload: { quantity: 25 }, // Inválido por regla de negocio, product tiene maxQuantity: 20 en purchaseRules
      cookies: { session: customerSessionId }
    })

    expect(
      response.statusCode,
      `Status code should be 400 but got ${JSON.stringify(response.body)}`
    ).toBe(400)
    const body = JSON.parse(response.body)
    expect(body.code).toBe("VALIDATION_RULES")
    expect(body.message).toContain("Máximo")
  })

  it("PATCH /carts/items/:variantId - debe fallar por Valibot si la cantidad es negativa", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/carts/items/${p2.variantId}`,
      payload: { quantity: -5 },
      cookies: { session: customerSessionId }
    })

    expect(response.statusCode).toBe(400)
    const body = JSON.parse(response.body)
    // Valibot debe atajar esto antes de que toque la BD
    expect(body.code).toBe("VALIDATION_ERROR")
    expect(body.issues).toHaveProperty("quantity")
  })

  // --- TESTS DE DELETE ---

  it("DELETE /carts - debe vaciar el carrito", async () => {
    // Metemos algo al carrito
    await app.inject({
      method: "POST",
      url: "/carts/items",
      payload: { variantId: p1.variantId, quantity: 1 },
      cookies: { session: customerSessionId }
    })
    // Borramos
    const response = await app.inject({
      method: "DELETE",
      url: "/carts",
      cookies: { session: customerSessionId }
    })
    expect(response.statusCode).toBe(200)

    // Verificamos
    const getResponse = await app.inject({
      method: "GET",
      url: "/carts",
      cookies: { session: customerSessionId }
    })

    const body = JSON.parse(getResponse.body)
    expect(body.items).toHaveLength(0)
  })
})
