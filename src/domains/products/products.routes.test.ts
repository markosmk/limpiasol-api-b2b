import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB, teardownTestDB } from "#test/utils/test-db"
import type { FastifyInstance } from "fastify"

import { priceTiers, products, productVariants } from "@/db/schema"
import productsRoutes from "@/domains/products/products.routes"

async function cleanPricingTables() {
  await db.delete(priceTiers).execute()
  await db.delete(productVariants).execute()
  await db.delete(products).execute()
}

describe("POST /products/:productId/price", () => {
  let app: FastifyInstance
  let testProduct: typeof products.$inferSelect
  let testVariant: typeof productVariants.$inferSelect
  let cleanup: (() => Promise<void>) | null = null

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(productsRoutes, "/products")
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await teardownTestDB()
    if (cleanup) {
      await cleanup()
      cleanup = null
    }
  })

  beforeEach(async () => {
    await cleanPricingTables()

    // Setup: producto con reglas B2B
    // Crear producto de test
    const [{ id: productTestId }] = await db
      .insert(products)
      .values({
        name: "Producto B2B Test",
        slug: `producto-b2b-${Date.now()}`,
        status: "published",
        purchaseRules: { minQuantity: 5, stepQuantity: 5, maxQuantity: 100 }
      })
      .$returningId()
    if (!productTestId) throw new Error("Failed to create test product")
    const productTest = await db.query.products.findFirst({
      where: eq(products.id, productTestId)
    })
    if (!productTest) throw new Error("Failed to find test product")

    testProduct = productTest

    // Crear variante de test
    const [{ id: variantTestAId }] = await db
      .insert(productVariants)
      .values({
        productId: productTestId,
        name: "Variante Premium",
        sku: `PREM-${Date.now()}`,
        options: { Tipo: "Premium" }
      })
      .$returningId()
    if (!variantTestAId) throw new Error("Failed to create test variant")
    const variantTest = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, variantTestAId)
    })
    if (!variantTest) throw new Error("Failed to find test variant")

    testVariant = variantTest
  })

  // ─────────────────────────────────────────
  // Escenario 1: Usuario anónimo (retail)
  // ─────────────────────────────────────────
  it("returns calculated price for ANONYMOUS user (retail tier)", async () => {
    // Arrange: insertar precio RETAIL (no reseller)
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail", // Retail, no reseller
      price: "100.00",
      compareAtPrice: "120.00",
      volumeDiscounts: [{ quantity: 10, discountPercent: 15 }]
    })

    // Act: SIN cookie de sesión (usuario anónimo)
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { variantId: null, quantity: 10 }
      // Sin cookies → userTier = "retail"
    })

    // Assert
    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.success).toBe(true)
    expect(body.data.pricing.unitPrice).toBe(85) // 100 - 15%
    expect(body.data.pricing.appliedTier).toBe("retail") // Retail, no reseller
    // expect(body.data.pricing).toMatchObject({
    //   unitPrice: 100,
    //   originalPrice: 120,
    //   appliedTier: "retail",
    //   currency: "USD",
    //   finalSubtotal: 100 // 100 * 1
    // })
  })

  // ─────────────────────────────────────────
  // Escenario 1: Usuario autenticado (reseller)
  // ─────────────────────────────────────────

  it("returns calculated price for authenticated reseller", async () => {
    // create user and sesion
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("reseller")
    // set cleanup function
    cleanup = userCleanup

    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "reseller",
      price: "100.00"
    })

    // Act: hacer request a la ruta
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: {
        variantId: null,
        quantity: 10
      },
      cookies: { session: sessionId }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.pricing.unitPrice).toBe(100)
    expect(body.data.pricing.appliedTier).toBe("reseller")
  })

  // ─────────────────────────────────────────
  // Escenario 2: Descuento por volumen
  // ─────────────────────────────────────────
  it("aplica descuento por volumen cuando quantity >= threshold", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00",
      volumeDiscounts: [
        { quantity: 10, discountPercent: 10 },
        { quantity: 50, discountPercent: 20 }
      ]
    })

    // Cantidad que aplica 10% de descuento
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 25 }
    })

    // Assert
    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.success).toBe(true)
    expect(body.data.pricing.unitPrice).toBe(90) // 100 - 10%
    expect(body.data.pricing.volumeDiscount).toEqual({
      quantity: 10,
      discountPercent: 10
    })
    expect(body.data.pricing.finalSubtotal).toBe(2250) // 90 * 25
  })

  // ─────────────────────────────────────────
  // Escenario 3: Validación de reglas B2B
  // ─────────────────────────────────────────
  it("rechaza cantidad menor al mínimo configurado", async () => {
    // Producto con minQuantity: 5
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 3 } // Menos del mínimo
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain("Mínimo")
    expect(body.suggestion).toContain("2") // Faltan 2 para llegar a 5
  })

  it("rechaza cantidad que no cumple stepQuantity", async () => {
    // Producto con stepQuantity: 5
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 12 } // No es múltiplo de 5
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toContain("múltiplo de 5")
    expect(body.suggestion).toContain("15") // Próximo múltiplo
  })

  // ─────────────────────────────────────────
  // Escenario 4: Precio específico para variante
  // ─────────────────────────────────────────
  it("usa precio de variante cuando se especifica variantId", async () => {
    await db.insert(priceTiers).values([
      // Precio base
      { productId: testProduct.id, variantId: null, tierType: "retail", price: "100.00" },
      // Precio específico para variante (más caro)
      { productId: testProduct.id, variantId: testVariant.id, tierType: "retail", price: "150.00" }
    ])

    // update rulesMin MAx.. min stablecide en 5..
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { variantId: testVariant.id, quantity: 5 }
    })

    const body = response.json()
    expect(body.data.pricing.unitPrice).toBe(150) // Precio de la variante
  })

  // ─────────────────────────────────────────
  // Escenario 5: Fallback a retail cuando tier no existe
  // ─────────────────────────────────────────
  it("fallback a retail cuando el userTier es RESELLER y no tiene precio configurado", async () => {
    // create user and sesion
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("reseller")
    // set cleanup function
    cleanup = userCleanup

    // remove old price tiers
    await db.delete(priceTiers).where(eq(priceTiers.productId, testProduct.id))

    // Solo existe precio retail, no reseller
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 5 },
      cookies: { session: sessionId }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.pricing.appliedTier).toBe("retail")
  })

  // ─────────────────────────────────────────
  // Escenario 6: Error cuando no hay precio disponible
  // ─────────────────────────────────────────
  it("retorna 404 cuando el producto no tiene ningún precio configurado", async () => {
    // Producto sin entries en price_tiers
    await db.delete(priceTiers).where(eq(priceTiers.productId, testProduct.id))

    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 5 }
    })

    expect(response.statusCode).toBe(404)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe("Precio no disponible")
  })

  it("retorna 404 cuando el producto no existe", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/products/product-no-existe/price`,
      payload: { quantity: 1 }
    })

    expect(response.statusCode).toBe(404)
  })

  // ─────────────────────────────────────────
  // Escenario 7: Validación de input básico
  // ─────────────────────────────────────────
  it("rechaza cantidad inválida (menor a 1)", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 0 }
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toContain("Cantidad inválida")
  })

  it("acepta variantId null explícitamente", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { variantId: null, quantity: 5 }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    expect(body.data.pricing.unitPrice).toBe(100)
  })

  // ─────────────────────────────────────────
  // Escenario 8: Validar el máximo permitido
  // ─────────────────────────────────────────
  it("rechaza cantidad mayor al máximo permitido/configurado", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 101 } // Mayor al máximo, el maximo es 100
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toContain("Máximo 100 unidades")
  })

  // ─────────────────────────────────────────
  // Escenario 9: Descuento por volumne No Aclnazado
  // ─────────────────────────────────────────
  it("cobra precio base si la cantidad no alcanza el mínimo para descuento por volumen", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00",
      volumeDiscounts: [{ quantity: 50, discountPercent: 20 }] // descuento a partir de 50
    })

    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { quantity: 10 } // compra solo 10 (cumple el minQuantity de 5 (porque el producto creado tiene configurado minQuantity: 5), pero no el de volumen)
    })
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.pricing.unitPrice).toBe(100)
  })

  // ─────────────────────────────────────────
  // Escenario 10: Fallback de variante a producto base
  // ─────────────────────────────────────────
  it("usa el precio base si se pide una variante que no tiene precio específico", async () => {
    // clean other prices
    await db.delete(priceTiers).where(eq(priceTiers.productId, testProduct.id))
    // solo insertamos el precio del producto base, NO el de la variante
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null, // precio base
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "POST",
      url: `/products/${testProduct.id}/price`,
      payload: { variantId: testVariant.id, quantity: 5 } // pedimos la variante
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.pricing.unitPrice).toBe(100)
  })
})

describe("POST /products/admin", () => {
  let app: FastifyInstance
  let cleanup: (() => Promise<void>) | null = null

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(productsRoutes, "/products")
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await teardownTestDB()
    if (cleanup) {
      await cleanup()
      cleanup = null
    }
  })

  it("crea un producto con todos sus detalles", async () => {
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("admin")
    cleanup = userCleanup

    const response = await app.inject({
      method: "POST",
      url: `/products/admin`,
      cookies: { session: sessionId },
      payload: {
        product: {
          name: "Producto de prueba",
          slug: "producto-prueba",
          status: "published",
          description: "Descripción de prueba",
          purchaseRules: { minQuantity: 1, stepQuantity: 1, maxQuantity: 100 },
          variants: [
            {
              sku: "VAR-001",
              name: "Variante 1",
              options: { Color: "Rojo" },
              stock: 10
            }
          ],
          prices: [
            {
              tierType: "retail",
              price: 100
            }
          ],
          categories: [],
          tags: [],
          collections: [],
          images: []
        }
      }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.product).not.toBeNull()
  })

  it("actualiza un producto existente", async () => {
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("admin")
    cleanup = userCleanup

    // 1. Crear producto primero
    const [{ id: productId }] = await db
      .insert(products)
      .values({
        name: "A actualizar",
        slug: "actualizar-me",
        status: "draft"
      })
      .$returningId()

    // 2. Actualizarlo
    const response = await app.inject({
      method: "PUT",
      url: `/products/admin/${productId}`,
      cookies: { session: sessionId },
      payload: {
        product: {
          name: "Producto Actualizado",
          status: "published",
          tags: ["nuevo-tag"]
        }
      }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.product.name).toBe("Producto Actualizado")
  })

  it("rechaza acceso a usuario no administrador (reseller)", async () => {
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("reseller")
    cleanup = userCleanup

    const response = await app.inject({
      method: "POST",
      url: `/products/admin`,
      cookies: { session: sessionId },
      payload: { product: { name: "Hack" } }
    })

    expect(response.statusCode).toBe(403)
  })

  it("elimina un producto", async () => {
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("admin")
    cleanup = userCleanup

    const [{ id: productId }] = await db
      .insert(products)
      .values({
        name: "A eliminar",
        slug: "borrame",
        status: "draft"
      })
      .$returningId()

    const response = await app.inject({
      method: "DELETE",
      url: `/products/admin/${productId}`,
      cookies: { session: sessionId }
    })

    expect(response.statusCode).toBe(200)

    // Verificar que ya no existe
    const exists = await db.query.products.findFirst({
      where: eq(products.id, productId)
    })
    expect(exists).toBeUndefined()
  })
})
