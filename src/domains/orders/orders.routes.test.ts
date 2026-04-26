/** biome-ignore-all lint/correctness/noUnusedVariables: <explanation > */
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB, teardownTestDB } from "#test/utils/test-db"
import type { FastifyInstance } from "fastify"

import {
  cartItems,
  carts,
  orderItems,
  orders,
  orderTimeline,
  type Product,
  priceTiers,
  products,
  productVariants
} from "@/db/pg"
import { notificationService } from "@/domains/notifications/notifications.service"
import ordersRoutes from "@/domains/orders/orders.routes"

async function createCartAndItemsBase(
  userId: string,
  payload: { productId: string; quantity: number; variantId?: string }[]
) {
  const [cart] = await db.insert(carts).values({ userId, status: "active" }).returning()
  if (!cart) {
    throw new Error("Carrito no encontrado")
  }
  await db.insert(cartItems).values(
    payload.map((item) => ({
      cartId: cart.id,
      quantity: item.quantity,
      variantId: item.variantId ?? "default_variant"
    }))
  )

  return cart
}

// mockear el envío de emails para no saturar la consola ni intentar envíos reales
vi.mock("@/domains/notifications/notifications.service", () => ({
  notificationService: {
    notifyNewOrder: vi.fn().mockResolvedValue(true),
    notifyPaymentRequired: vi.fn().mockResolvedValue(true),
    notifyOrderPaid: vi.fn().mockResolvedValue(true),
    notifyOrderDispatched: vi.fn().mockResolvedValue(true),
    notifyOrderCancelled: vi.fn().mockResolvedValue(true)
  }
}))

async function cleanOrdersTables() {
  await db.delete(orderTimeline).execute()
  await db.delete(orderItems).execute()
  await db.delete(orders).execute()
  await db.delete(priceTiers).execute()
  await db.delete(productVariants).execute()
  await db.delete(products).execute()
}

describe("Orders Domain - B2B Flow", () => {
  let app: FastifyInstance
  let testProduct: Product
  let testProduct2: Product
  let cleanupSession: (() => Promise<void>) | null = null
  let customerSessionId: string
  let adminSessionId: string
  let customerId: string
  let adminId: string

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(ordersRoutes, "")
    await app.ready()
  })

  afterAll(async () => {
    // 1. borrar todas las órdenes creadas en los tests (libera el Foreign Key)
    await cleanOrdersTables()
    // 2. borrar los usuarios sin error de restricción
    if (cleanupSession) await cleanupSession()
    // 3. cerrar la instancia de Fastify
    await app.close()
    // 4. limpiar la base de datos de test
    await teardownTestDB()
  })

  beforeEach(async () => {
    await cleanOrdersTables()
    vi.clearAllMocks()

    // 1. setup Usuarios (Cliente Reseller y Admin)
    const customerAuth = await createTestUserAndSession("reseller")
    customerSessionId = customerAuth.sessionId
    customerId = customerAuth.user.id

    const adminAuth = await createTestUserAndSession("admin")
    adminSessionId = adminAuth.sessionId
    adminId = adminAuth.user.id

    // guardamos un cleanup compuesto
    cleanupSession = async () => {
      await customerAuth.cleanup()
      await adminAuth.cleanup()
    }

    // 2. setup Productos y Precios
    const [{ id: p1Id }] = await db
      .insert(products)
      .values({
        name: "Tornillos X",
        slug: "tornillos",
        status: "published",
        purchaseRules: { minQuantity: 10, stepQuantity: 1 }
      })
      .returning({ id: products.id })

    const [{ id: p2Id }] = await db
      .insert(products)
      .values({
        name: "Tuercas Y",
        slug: "tuercas",
        status: "published"
      })
      .returning({ id: products.id })

    await db.insert(priceTiers).values([
      { productId: p1Id, tierType: "reseller", price: "5.00" },
      { productId: p2Id, tierType: "reseller", price: "2.00" }
    ])

    const product1 = await db.query.products.findFirst({ where: eq(products.id, p1Id) })
    const product2 = await db.query.products.findFirst({ where: eq(products.id, p2Id) })

    if (!product1 || !product2) {
      throw new Error("Productos no encontrados")
    }

    testProduct = product1
    testProduct2 = product2
  })

  // ─────────────────────────────────────────
  // Fase 1: Creación de la Orden (Cliente)
  // ─────────────────────────────────────────
  describe("POST /orders - Create Order", () => {
    let cartId: string

    beforeEach(async () => {
      // crear carrito
      const [cart] = await db
        .insert(carts)
        .values({ userId: customerId, status: "active" })
        .returning({ id: carts.id })
      if (!cart) {
        throw new Error("Carrito no encontrado")
      }
      cartId = cart.id

      // agregar items al carrito
      await db.insert(cartItems).values([
        {
          cartId: cart.id,
          variantId: "var_1",
          quantity: 20
        },
        {
          cartId: cart.id,
          variantId: "var_2",
          quantity: 50
        }
      ])
    })

    it("rechaza una orden sin authenticacion", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/orders",
        payload: {
          deliveryType: "shipping",
          shippingData: {
            fullName: "Juan Perez",
            addressLine1: "Calle Falsa 123",
            city: "Capital",
            province: "Buenos Aires",
            postalCode: "1000",
            phone: "1122334455"
          },
          items: [
            { productId: testProduct.id, quantity: 20 }, // 20 * $5 = $100
            { productId: testProduct2.id, quantity: 50 } // 50 * $2 = $100
          ]
        }
      })
      expect(response.statusCode).toBe(401)
    })

    it("debe crear una orden exitosamente y notificar", async () => {
      const payload = {
        deliveryType: "shipping",
        shippingData: {
          fullName: "Juan Perez",
          addressLine1: "Calle Falsa 123",
          city: "Capital",
          province: "Buenos Aires",
          postalCode: "1000",
          phone: "1122334455"
        },
        items: [
          { productId: testProduct.id, quantity: 20 }, // 20 * $5 = $100
          { productId: testProduct2.id, quantity: 50 } // 50 * $2 = $100
        ]
      }

      const response = await app.inject({
        method: "POST",
        url: "/orders",
        payload,
        cookies: { session: customerSessionId }
      })

      // Assert Response
      expect(response.statusCode).toBe(201)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.data.orderId).toBeDefined()
      expect(body.data.total).toBe("200.00") // 100 + 100

      // Assert Base de Datos
      const savedOrder = await db.query.orders.findFirst({
        where: eq(orders.id, body.data.orderId),
        with: { items: true, timeline: true } // Asumiendo config Drizzle relacional
      })

      expect(savedOrder?.status).toBe("pending")
      expect(savedOrder?.items.length).toBe(2)

      // Assert Notificaciones
      expect(notificationService.notifyNewOrder).toHaveBeenCalledTimes(1)
    })

    it("debe fallar si no cumple reglas de compra (minQuantity)", async () => {
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)

      // add item product 1 to cart itemns wit 5 in quantity
      await db.insert(cartItems).values({
        cartId: cartId,
        variantId: "var_1",
        quantity: 5 // Error: minQuantity es 10
      })

      const payload = {
        deliveryType: "pickup",
        pickupLocationData: {
          locationId: "loc_1",
          locationName: "Central",
          address: "Calle 1",
          scheduledDate: "2026-11-11", //tomorrow.toISOString().split("T")[0], // No se permiten fechas pasadas.. daria error ORDER_INVALID_SCHEDULE
          scheduledTime: "10:00"
        }
      }

      const response = await app.inject({
        method: "POST",
        url: "/orders",
        payload,
        cookies: { session: customerSessionId }
      })

      expect(response.statusCode, `Status code should be 400 ${response.body}`).toBe(400)
      const body = response.json()
      expect(body.code, `Code should be ORDER_INVALID_QUANTITY ${response.body}`).toBe(
        "ORDER_INVALID_QUANTITY"
      )
    })
  })

  // ─────────────────────────────────────────
  // Fase 2: Ajustes por el Admin (Negociación)
  // ─────────────────────────────────────────
  describe("PATCH & DELETE /admin/orders/:id/items - Edición de Admin", () => {
    let activeOrderId: string
    let firstItemId: string
    let cartId: string

    beforeEach(async () => {
      // create cart and cart items
      const cart = await createCartAndItemsBase(customerId, [
        {
          productId: testProduct.id,
          quantity: 10 // 10 * 5 = $50
        },
        {
          productId: testProduct2.id,
          quantity: 10 // 10 * 2 = $20
        }
      ])
      cartId = cart.id

      // pre-condición: una orden base para editar
      const payload = {
        deliveryType: "shipping",
        shippingData: {
          fullName: "Test Admin Edit",
          addressLine1: "Calle Falsa 123",
          city: "Capital",
          province: "Buenos Aires",
          postalCode: "1000",
          phone: "1122334455"
        }
      }

      const res = await app.inject({
        method: "POST",
        url: "/orders",
        payload,
        cookies: { session: customerSessionId }
      })
      if (res.statusCode !== 201) {
        throw new Error(`Fallo el Setup del Test. Status: ${res.statusCode}, Body: ${res.payload}`)
      }

      activeOrderId = res.json().data.orderId

      // traer el primer item para tener su ID
      const orderInDb = await db.query.orders.findFirst({
        where: eq(orders.id, activeOrderId),
        with: { items: true }
      })
      // buscar el item que corresponde al producto de $5
      const targetItem = orderInDb!.items.find((i) => i.productId === testProduct.id)
      firstItemId = targetItem!.id
    })

    it("Admin debe poder actualizar la cantidad de un item y recalcular totales", async () => {
      // Act: Admin cambia la cantidad de 10 a 20 del primer producto
      const response = await app.inject({
        method: "PATCH",
        url: `/admin/orders/${activeOrderId}/items/${firstItemId}`,
        payload: { quantity: 20 },
        cookies: { session: adminSessionId } // Admin auth
      })

      // Assert
      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Totales: (20 * $5) + (10 * $2) = $100 + $20 = $120
      expect(body.newTotal).toBe("120.00")

      // Verificar Timeline
      const timeline = await db.query.orderTimeline.findMany({
        where: eq(orderTimeline.orderId, activeOrderId)
      })
      const adjustmentEvent = timeline.find((e) => e.eventType === "items_adjusted")
      expect(adjustmentEvent).toBeDefined()
    })

    it("Admin debe poder remover un item de la orden", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/admin/orders/${activeOrderId}/items/${firstItemId}`,
        cookies: { session: adminSessionId }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()

      // Quedó solo el producto 2: (10 * $2) = $20
      expect(body.newTotal).toBe("20.00")
    })

    it("Debe fallar si el cliente (no admin) intenta editar un item", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/admin/orders/${activeOrderId}/items/${firstItemId}`,
        payload: { quantity: 5 },
        cookies: { session: customerSessionId } // Auth del cliente
      })

      // Dependiendo cómo se configure requireRole(["admin"]), debería ser 403 o 401
      expect(response.statusCode).toBeGreaterThanOrEqual(401)
    })

    it("Admin debe poder cambiar el tipo de entrega de shipping a pickup", async () => {
      // Usamos el activeOrderId que fue creado en beforeEach
      const response = await app.inject({
        method: "PATCH",
        url: `/admin/orders/${activeOrderId}/delivery`,
        payload: {
          deliveryType: "pickup",
          pickupLocationData: {
            locationId: "loc_centro",
            locationName: "Sucursal Centro",
            address: "Av. Principal 123",
            scheduledDate: "2026-10-10",
            scheduledTime: "15:00"
          }
        },
        cookies: { session: adminSessionId }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)
      expect(body.newDeliveryType).toBe("pickup")

      // Verificamos en DB que limpió los datos de shipping y guardó los de pickup
      const dbOrder = await db.query.orders.findFirst({
        where: eq(orders.id, activeOrderId)
      })
      expect(dbOrder?.deliveryType).toBe("pickup")
      expect(dbOrder?.shippingData).toBeNull() // Se debió limpiar
      expect(dbOrder?.pickupLocationData?.locationName).toBe("Sucursal Centro")
    })
  })

  // ─────────────────────────────────────────
  // Fase 3: Transiciones de Estado y Cancelación
  // ─────────────────────────────────────────
  describe("POST /orders/:id/cancel - Cancelaciones", () => {
    let orderToCancelId: string
    let cartId: string

    beforeEach(async () => {
      // create cart and cart items
      const cart = await createCartAndItemsBase(customerId, [
        {
          productId: testProduct.id,
          quantity: 10 // 10 * 5 = $50
        },
        {
          productId: testProduct2.id,
          quantity: 10 // 10 * 2 = $20
        }
      ])
      cartId = cart.id

      const res = await app.inject({
        method: "POST",
        url: "/orders",
        payload: {
          deliveryType: "pickup",
          pickupLocationData: {
            locationId: "1",
            locationName: "C",
            address: "A",
            scheduledDate: "2026-06-01",
            scheduledTime: "10:00"
          },
          items: [{ productId: testProduct.id, quantity: 10 }]
        },
        cookies: { session: customerSessionId }
      })
      orderToCancelId = res.json().data.orderId
    })

    it("Cliente debe poder cancelar su orden si está en pending", async () => {
      // limpiamos los contadores del mock antes de actuar
      vi.clearAllMocks()

      const response = await app.inject({
        method: "POST",
        url: `/orders/${orderToCancelId}/cancel`,
        payload: { reason: "Me arrepentí de la compra" },
        cookies: { session: customerSessionId }
      })

      expect(response.statusCode).toBe(200)

      // verificar que el servicio fue llamado con los datos correctos
      expect(notificationService.notifyOrderCancelled).toHaveBeenCalledTimes(1)
      // verificar el contenido del primer argumento (order) y segundo (email)
      expect(notificationService.notifyOrderCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          orderCode: expect.any(String)
        }),
        expect.stringMatching(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/), // el email del cliente
        "Me arrepentí de la compra" // la razón
      )

      const dbOrder = await db.query.orders.findFirst({
        where: eq(orders.id, orderToCancelId)
      })
      expect(dbOrder?.status).toBe("cancelled")
      expect(dbOrder?.cancelReason).toBe("Me arrepentí de la compra")
    })

    it("Cliente NO debe poder cancelar si la orden ya está shipped", async () => {
      // 1. admin fuerza el estado a shipped
      await db.update(orders).set({ status: "shipped" }).where(eq(orders.id, orderToCancelId))

      // 2. cliente intenta cancelar
      const response = await app.inject({
        method: "POST",
        url: `/orders/${orderToCancelId}/cancel`,
        payload: { reason: "Quiero cancelar" },
        cookies: { session: customerSessionId }
      })

      expect(response.statusCode).toBe(400)
      expect(response.json().code).toBe("ORDER_NOT_CANCELLABLE")
    })
  })

  // ─────────────────────────────────────────
  // Fase 4: Ajuste Manual de Precios (Admin)
  // ─────────────────────────────────────────
  describe("PATCH /admin/orders/:id/pricing - Ajustes Manuales", () => {
    let orderToAdjustId: string
    let cartId: string

    beforeEach(async () => {
      // create cart and cart items
      const cart = await createCartAndItemsBase(customerId, [
        {
          productId: testProduct.id,
          quantity: 10 // 10 * 5 = $50
        }
      ])
      cartId = cart.id

      // Setup: Creamos una orden limpia para esta prueba
      const res = await app.inject({
        method: "POST",
        url: "/orders",
        payload: {
          deliveryType: "shipping",
          shippingData: {
            fullName: "Test",
            addressLine1: "A",
            city: "C",
            province: "P",
            postalCode: "1000",
            phone: "1234567890"
          }
        },
        cookies: { session: customerSessionId }
      })
      if (res.statusCode !== 201) {
        throw new Error(`Fallo el Setup del Test. Status: ${res.statusCode}, Body: ${res.payload}`)
      }
      orderToAdjustId = res.json().data.orderId
    })

    it("Admin debe poder aplicar un descuento manual y bajar el total", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/admin/orders/${orderToAdjustId}/pricing`,
        payload: {
          adjustment: "-15.00", // hacemos 15 pesos de descuento
          reason: "Descuento especial por demora",
          notifyCustomer: false
        },
        cookies: { session: adminSessionId }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.success).toBe(true)

      // Total original 50.00 - 15.00 = 35.00
      expect(body.newTotal).toBe("35.00")

      // Verificar en BD que el manualAdjustment se guardó
      const dbOrder = await db.query.orders.findFirst({
        where: eq(orders.id, orderToAdjustId)
      })
      expect(dbOrder?.manualAdjustment).toBe("-15.00")
      expect(dbOrder?.total).toBe("35.00")
    })

    it("Admin debe poder aplicar un recargo manual (positivo) y subir el total", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/admin/orders/${orderToAdjustId}/pricing`,
        payload: {
          adjustment: "20.50", // Recargo por embalaje
          reason: "Costo extra de embalaje frágil"
        },
        cookies: { session: adminSessionId }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()

      // Total original 50.00 + 20.50 = 70.50
      expect(body.newTotal).toBe("70.50")
    })
  })

  // ─────────────────────────────────────────
  // Fase 5: Lectura y Privacidad (GET)
  // ─────────────────────────────────────────
  describe("GET /orders & /admin/orders - Lectura de Datos", () => {
    let activeOrderId: string
    let otherUserSessionId: string

    beforeEach(async () => {
      // 1. Creamos un segundo cliente para probar accesos prohibidos
      const otherAuth = await createTestUserAndSession("user")
      otherUserSessionId = otherAuth.sessionId

      // create cart and items
      const cart = await createCartAndItemsBase(customerId, [
        {
          productId: testProduct.id,
          quantity: 10
        }
      ])
      // beforeAll para crear una sola orden que leeremos varias veces
      try {
        const res = await app.inject({
          method: "POST",
          url: "/orders",
          payload: {
            deliveryType: "pickup",
            pickupLocationData: {
              locationId: "loc_1",
              locationName: "Central",
              address: "Calle 1",
              scheduledDate: "2026-06-01",
              scheduledTime: "10:00"
            }
          },
          cookies: { session: customerSessionId }
        })
        // al crear una order se agrega autoamticamente un orderTimeline order_created

        if (res.statusCode !== 201) {
          throw new Error(
            `Fallo el Setup del Test. Status: ${res.statusCode}, Body: ${res.payload}`
          )
        }
        activeOrderId = res.json().data.orderId
      } catch (error) {
        console.error("Error en beforeAll:", error)
        throw error
      }
    })

    it("Cliente - debe poder ver el detalle de SU propia orden sin timeline", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/orders/${activeOrderId}`,
        cookies: { session: customerSessionId }
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()

      expect(body.success).toBe(true)
      expect(body.data.id).toBe(activeOrderId)
      // Debe traer los items populados
      expect(body.data.items).toBeDefined()
      expect(body.data.items.length).toBeGreaterThan(0)
      // otras
      expect(body.data.items[0].productName).toBe("Tornillos X")

      // Verificamos que no se filtren datos internos
      expect(body.data.timeline).toBeUndefined()
    })

    it("Client - Debe fallar (401/403) si un cliente intenta entrar a las rutas de Admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/admin/orders",
        cookies: { session: customerSessionId } // Auth de cliente, no admin
      })

      // El preHandler de roles debería bloquear esto
      expect(response.statusCode).toBeGreaterThanOrEqual(401)
    })

    it("Cliente - debe retornar 404/403 si intenta ver la orden de OTRO usuario", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/orders/${activeOrderId}`,
        cookies: { session: otherUserSessionId } // Sesión del intruso
      })

      // Depende de cómo lo manejes en tu servicio (recomiendo 404 para no revelar que la orden existe)
      expect([403, 404]).toContain(response.statusCode)
    })

    it("Admin debe poder listar todas las órdenes paginadas", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/admin/orders?limit=10&page=1",
        cookies: { session: adminSessionId }
      })
      expect(
        response.statusCode,
        `Falló el request. Body: ${JSON.stringify(response.json(), null, 2)}`
      ).toBe(200)
      const body = response.json()

      expect(body.success).toBe(true)
      expect(Array.isArray(body.data.orders)).toBe(true)
      // Tiene que haber al menos la que creamos en el beforeAll y las de los tests anteriores
      expect(body.data.total).toBeGreaterThan(0)
      expect(body.data.hasMore).toBeDefined()
    })

    it("Admin - debe retornar 200, ver CUALQUIER orden y traer el timeline", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/admin/orders/${activeOrderId}`,
        cookies: { session: adminSessionId } // Sesión del admin
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()

      expect(body.data.id).toBe(activeOrderId)
      expect(body.data.items).toHaveLength(1)

      // El admin SÍ debe recibir el timeline
      expect(body.data.timeline).toBeDefined()
      expect(body.data.timeline).toHaveLength(1)
      expect(body.data.timeline[0].eventType).toBe("order_created")
    })
  })
})
