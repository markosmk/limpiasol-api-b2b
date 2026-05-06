import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB, teardownTestDB } from "#test/utils/test-db"
import type { FastifyInstance } from "fastify"

import { priceTiers, productImages, products, productVariants } from "@/db/pg"
import productsRoutes from "@/domains/products/products.routes"

function expectValidationError(
  // biome-ignore lint/suspicious/noExplicitAny: <explanation >
  response: any,
  expectedField: string
) {
  expect(response.statusCode).toBe(400)
  const body = response.json()
  expect(body.code).toBe("VALIDATION_ERROR")
  expect(body.issues).toBeDefined()
  expect(body.issues).toHaveProperty(expectedField)
  expect(Array.isArray(body.issues[expectedField])).toBe(true)
  return body
}

async function cleanPricingTables() {
  await db.delete(priceTiers).execute()
  await db.delete(productVariants).execute()
  await db.delete(products).execute()
}

describe("GET /products/:productId/price", () => {
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
        isPricePublic: true,
        purchaseRules: { minQuantity: 5, stepQuantity: 5, maxQuantity: 100 }
      })
      .returning({ id: products.id })
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
      .returning({ id: productVariants.id })
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
  it("devolver precio calculado para usuario anónimo (retail tier)", async () => {
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        // variantId: "", // no hay variante, no enviar esta prop
        quantity: "10"
      }
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

  it("retorna 403 cuando el producto no tiene precio público y el usuario es anónimo", async () => {
    // Setup: producto con precio oculto
    await db.update(products).set({ isPricePublic: false }).where(eq(products.id, testProduct.id))

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "5"
      }
    })

    expect(response.statusCode).toBe(403)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe("Precio oculto")
  })

  it("cae en retail cuando la sesión es inválida o expirada (cookie corrupta)", async () => {
    // Setup: precio retail disponible
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "5"
      },
      cookies: { session: "sesion-inexistente-o-corrupta" }
    })

    // optionalAuth falla silenciosamente -> request.user = null -> tier retail
    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.pricing.appliedTier).toBe("retail")
    expect(body.data.pricing.unitPrice).toBe(100)
  })

  // ─────────────────────────────────────────
  // Escenario 1: Usuario autenticado (reseller)
  // ─────────────────────────────────────────

  it("devolver precio calculado para usuario autenticado (reseller)", async () => {
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        // variantId: "", // no hay variante, no enviar esta prop
        quantity: "10"
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        // no se envia variantId porque no hay variante
        quantity: "25"
      }
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

  it("elige el descuento más alto aplicable cuando hay múltiples escalones", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00",
      volumeDiscounts: [
        { quantity: 10, discountPercent: 10 },
        { quantity: 20, discountPercent: 20 },
        { quantity: 50, discountPercent: 30 }
      ]
    })

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "25" // Aplica el de 20 (>=20 y <50)
      }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.pricing.unitPrice).toBe(80) // 100 - 20%
    expect(body.data.pricing.volumeDiscount.discountPercent).toBe(20)
  })

  // ─────────────────────────────────────────
  // Escenario 3: Validación de reglas B2B
  // ─────────────────────────────────────────
  it("rechaza cantidad menor al mínimo configurado", async () => {
    // Producto con minQuantity: 5
    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "3"
      } // Menos del mínimo
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "12" // No es múltiplo de 5
      }
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toContain("múltiplo de 5")
    expect(body.suggestion).toContain("15") // Próximo múltiplo
  })

  it("acepta cantidad exactamente en el límite permitido (ej: maxQuantity)", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "100" // El máximo es 100
      }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().data.pricing.finalSubtotal).toBe(10000)
  })

  it("no acepta cantidad que sobrepasa el límite permitido (ej: maxQuantity)", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "101" // Mayor al máximo, el maximo es 100
      }
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toContain("Máximo 100 unidades")
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        variantId: testVariant.id,
        quantity: "5"
      }
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "5"
      },
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "5"
      }
    })

    expect(response.statusCode).toBe(404)
    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe("Precio no disponible")
  })

  it("retorna 404 cuando el producto no existe", async () => {
    const { sessionId, cleanup: userCleanup } = await createTestUserAndSession("reseller")
    cleanup = userCleanup

    const response = await app.inject({
      method: "GET",
      url: `/products/product-no-existe/price`,
      query: {
        quantity: "1"
      },
      cookies: { session: sessionId }
    })

    expect(response.statusCode).toBe(404)
  })

  it("retorna 404 cuando el producto está en estado 'draft'", async () => {
    // Insertar precios primero (si no, da 404 por falta de precio)
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    // Cambiar producto a draft
    await db.update(products).set({ status: "draft" }).where(eq(products.id, testProduct.id))

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "5"
      }
    })

    // Si el producto es draft, la API debería retornar 404 o 403
    expect(response.statusCode).toBe(404)
  })

  // ─────────────────────────────────────────
  // Escenario 7: Validación de input básico
  // ─────────────────────────────────────────
  it("rechaza cantidad inválida (menor a 1)", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "0"
      }
    })

    // expect(response.statusCode).toBe(400)
    // const body = await response.json()

    const body = expectValidationError(response, "quantity")
    expect(body.issues.quantity[0]).toMatch(/number|numero|invalid/i)

    // structure base checking information by Handler Valibot
    // expect(body.statusCode).toBe(400)
    // expect(body.code).toBe("VALIDATION_ERROR")
    // expect(body.message).toBe("Los datos enviados no son válidos")
    // // Verificar que existe el campo quantity en issues
    // expect(body.issues).toBeDefined()
    // expect(body.issues).toHaveProperty("quantity")
    // expect(Array.isArray(body.issues.quantity)).toBe(true)
    // expect(body.issues.quantity.length).toBeGreaterThan(0)
    // // verificar que es un error de número, sin depender del texto exacto (apto cambios de idioma o version de valibot)
    // const errorMessage = body.issues.quantity[0].toLowerCase()
    // expect(
    //   errorMessage.includes("number") ||
    //     errorMessage.includes("numero") ||
    //     errorMessage.includes("invalid")
    // ).toBe(true)
  })

  // como es por query.. la cantidad puede no ser un numero como "$10"
  it("rechaza cantidad inválida (es texto con número o no es un numero)", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "$10"
      }
    })

    // structure base checking information by Handler Valibot
    const body = expectValidationError(response, "quantity")
    expect(body.issues.quantity[0]).toMatch(/number|numero|invalid/i)
  })

  it("el variantId es un string que no es un cuid2", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        variantId: "not-a-cuid2",
        quantity: "1"
      }
    })

    const body = expectValidationError(response, "variantId")
    expect(body.issues.variantId[0]).toMatch(/cuid2|invalid/i)
  })

  it("acepta variantId vacio explícitamente en el queryparams, toma el precio base", async () => {
    await db.insert(priceTiers).values({
      productId: testProduct.id,
      variantId: null,
      tierType: "retail",
      price: "100.00"
    })

    const response = await app.inject({
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        // not sending this property works too
        quantity: "5"
      }
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "101" // Mayor al máximo, el maximo es 100
      }
    })

    expect(response.statusCode).toBe(400)
    const body = response.json()
    expect(body.error).toContain("Máximo 100 unidades")
  })

  // ─────────────────────────────────────────
  // Escenario 9: Descuento por volumne No Alcanzado
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        quantity: "10" // compra solo 10 (cumple el minQuantity de 5 (porque el producto creado tiene configurado minQuantity: 5), pero no el de volumen)
      }
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
      method: "GET",
      url: `/products/${testProduct.id}/price`,
      query: {
        variantId: testVariant.id,
        quantity: "5" // pedimos la variante
      }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.data.pricing.unitPrice).toBe(100)
  })

  // ─────────────────────────────────────────
  // Escenario 11: Cache headers
  // TODO: Implementar cache en la ruta y descomentar el test
  // ─────────────────────────────────────────
  // it("incluye headers de cache para respuestas exitosas", async () => {
  //   await db.insert(priceTiers).values({
  //     productId: testProduct.id,
  //     variantId: null,
  //     tierType: "retail",
  //     price: "100.00"
  //   })

  //   const response = await app.inject({
  //     method: "GET",
  //     url: `/products/${testProduct.id}/price`,
  //     query: { quantity: "5" }
  //   })

  //   expect(response.statusCode).toBe(200)
  //   expect(response.headers["cache-control"]).toBeDefined()
  // })
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
      .returning({ id: products.id })

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

  it("UPDATE CRITICAL - crea un producto sin variantes y auto-genera la variante por defecto (Modo Shopify)", async () => {
    const { sessionId } = await createTestUserAndSession("admin")

    const response = await app.inject({
      method: "POST",
      url: `/products/admin`,
      cookies: { session: sessionId },
      payload: {
        product: {
          name: "Silla de Oficina",
          slug: "silla-oficina",
          status: "published",
          // NOTA: No enviamos 'variants' intencionalmente
          prices: [{ tierType: "retail", price: 50000 }]
        }
      }
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()

    // 1. Verificamos la respuesta de la API
    expect(body.data.product.variants).toBeDefined()
    expect(body.data.product.variants.length).toBe(1)
    expect(body.data.product.variants[0].name).toBe("Única")
    expect(body.data.product.variants[0].sku).toMatch(/^SKU-/)

    // 2. Verificamos la Base de Datos Real
    const dbVariants = await db.query.productVariants.findMany({
      where: eq(productVariants.productId, body.data.product.id)
    })
    expect(dbVariants).toHaveLength(1)

    // 3. Verificamos que el precio general se haya guardado sin atarse a ninguna variante (variantId = null)
    const dbPrices = await db.query.priceTiers.findMany({
      where: eq(priceTiers.productId, body.data.product.id)
    })
    expect(dbPrices[0].variantId).toBeNull()
  })

  it("UPDATE CRITICAL - evita que un producto se quede sin variantes al intentar borrarlas todas (variants: [])", async () => {
    const { sessionId } = await createTestUserAndSession("admin")

    // 1. Creamos el producto inicial manualmente en la DB
    const [{ id: productId }] = await db
      .insert(products)
      .values({
        name: "Producto con Variante",
        slug: "prod-variante"
      })
      .returning({ id: products.id })

    await db.insert(productVariants).values({
      id: "var_1",
      productId,
      name: "Original",
      sku: "ORIGINAL-1",
      options: { Tipo: "Original" }
    })

    // 2. Intentamos vaciar las variantes enviando un array vacío
    const response = await app.inject({
      method: "PUT",
      url: `/products/admin/${productId}`,
      cookies: { session: sessionId },
      payload: {
        product: {
          variants: [] // El array vacío indica "borrar todo"
        }
      }
    })

    expect(response.statusCode).toBe(200)

    // 3. Verificamos en BD que no se quedó huérfano (debió inyectar la variante por defecto)
    const currentVariants = await db.query.productVariants.findMany({
      where: eq(productVariants.productId, productId)
    })

    expect(currentVariants.length).toBe(1)
    expect(currentVariants[0].name).toBe("Única") // Reemplazó "Original" por la default
  })

  it("UPDATE CRITICAL - actualiza variantes y mantiene/enlaza correctamente los precios e imágenes a través del SKU", async () => {
    const { sessionId } = await createTestUserAndSession("admin")

    // 1. Creamos producto y 2 variantes iniciales
    const [{ id: productId }] = await db
      .insert(products)
      .values({
        name: "Zapatillas",
        slug: "zapatillas-1"
      })
      .returning({ id: products.id })

    await db.insert(productVariants).values([
      { id: "var_roja", productId, name: "Roja", sku: "ZAP-ROJA", options: {} },
      { id: "var_azul", productId, name: "Azul", sku: "ZAP-AZUL", options: {} }
    ])

    // 2. Actualizamos, enviamos precios e imágenes atados a los SKUs
    const response = await app.inject({
      method: "PUT",
      url: `/products/admin/${productId}`,
      cookies: { session: sessionId },
      payload: {
        product: {
          // Re-enviamos las variantes para no borrarlas
          variants: [
            { id: "var_roja", name: "Roja Editada", sku: "ZAP-ROJA", options: {} },
            { id: "var_azul", name: "Azul", sku: "ZAP-AZUL", options: {} }
          ],
          prices: [
            { tierType: "retail", price: 100, variantSku: "ZAP-ROJA" }, // Atado a la roja
            { tierType: "wholesale", price: 80 } // General (aplica a todo)
          ],
          images: [
            { url: "roja.jpg", variantSku: "ZAP-ROJA" }, // Atado a la roja
            { url: "azul.jpg", variantSku: "ZAP-AZUL" } // Atado a la azul
          ]
        }
      }
    })

    expect(response.statusCode).toBe(200)

    // 3. Verificamos los Precios en la BD
    const currentPrices = await db.query.priceTiers.findMany({
      where: eq(priceTiers.productId, productId)
    })

    expect(currentPrices).toHaveLength(2)
    const precioRojo = currentPrices.find((p) => p.tierType === "retail")
    const precioGeneral = currentPrices.find((p) => p.tierType === "wholesale")

    expect(precioRojo?.variantId).toBe("var_roja") // Enlazó correctamente el ID
    expect(precioGeneral?.variantId).toBeNull() // Se mantuvo general

    // 4. Verificamos las Imágenes en la BD
    const currentImages = await db.query.productImages.findMany({
      where: eq(productImages.productId, productId)
    })

    expect(currentImages).toHaveLength(2)
    const imgRoja = currentImages.find((i) => i.url === "roja.jpg")
    expect(imgRoja?.variantId).toBe("var_roja")
  })

  it("UPDATE CRITICAL - mantiene intactas las variantes y precios si no se envían en el payload (Partial Update)", async () => {
    const { sessionId } = await createTestUserAndSession("admin")

    const [{ id: productId }] = await db
      .insert(products)
      .values({
        name: "Producto Intacto",
        slug: "prod-intacto"
      })
      .returning({ id: products.id })

    await db.insert(productVariants).values({
      id: "var_1",
      productId,
      name: "Variante Intacta",
      sku: "INTACTO-1",
      options: {}
    })

    await db.insert(priceTiers).values({
      productId,
      tierType: "retail",
      price: "100.00"
    })

    // Act: Hacemos un PUT solo con el nombre (variants y prices están undefined)
    const response = await app.inject({
      method: "PUT",
      url: `/products/admin/${productId}`,
      cookies: { session: sessionId },
      payload: {
        product: {
          name: "Producto Modificado"
        }
      }
    })

    expect(response.statusCode).toBe(200)

    // Assert: Verificamos que la DB no borró la variante ni el precio
    const variantsInDb = await db.query.productVariants.findMany({
      where: eq(productVariants.productId, productId)
    })
    const pricesInDb = await db.query.priceTiers.findMany({
      where: eq(priceTiers.productId, productId)
    })

    expect(variantsInDb).toHaveLength(1)
    expect(pricesInDb).toHaveLength(1)
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
      .returning({ id: products.id })

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
