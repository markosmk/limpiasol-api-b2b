import {
  buildOrderItemSnapshot,
  calculateOrderTotals,
  generateOrderCode,
  getStatusTransitionError,
  isValidPickupSchedule
} from "./lib/orders.utils"
import { type OrdersRepository, ordersRepository } from "./orders.repository"
import type { InternalNote, OrderStatus } from "@/db/pg/orders.types"
import type { UserTier } from "@/domains/products/pricing/pricing.types"
import type {
  CreateOrderRequest,
  CreateOrderResult,
  GetOrdersFilters,
  GetOrdersResult
} from "./orders.types"

import { type CartsService, cartsService } from "@/domains/carts/carts.service"
import {
  type NotificationService,
  notificationService
} from "@/domains/notifications/notifications.service"
import { validatePurchaseRules } from "@/domains/products/lib/pricing.utils"
import { type ProductsRepository, productsRepository } from "@/domains/products/products.repository"
import { usersRepository } from "@/domains/users/users.repository"
import { AppError } from "@/utils/app-error"

export class OrdersService {
  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly cartsService: CartsService,
    private readonly productsRepo: ProductsRepository,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Crea una nueva orden con snapshot de productos + transacción
   */
  async createOrder(
    userId: string,
    userTier: UserTier,
    input: CreateOrderRequest
  ): Promise<CreateOrderResult> {
    // 1. Obtener el carrito activo desde la base de datos (¡Fuente de verdad!)
    const cart = await this.cartsService.getActiveCartHydrated(userId, userTier)

    if (!cart?.id || cart?.items.length === 0) {
      throw new AppError({ code: "ORDER_EMPTY", message: "El carrito está vacío" })
    }

    if (input.deliveryType === "pickup" && !input.pickupLocationData) {
      throw new AppError({ code: "ORDER_MISSING_PICKUP" })
    }

    if (input.pickupLocationData) {
      const { scheduledDate, scheduledTime } = input.pickupLocationData
      if (!isValidPickupSchedule(scheduledDate, scheduledTime)) {
        throw new AppError({ code: "ORDER_INVALID_SCHEDULE" })
      }
    }

    // 2. Generar orderCode único (reintentar si colisión)
    let orderCode = generateOrderCode()
    let attempts = 0
    while ((await this.ordersRepo.orderCodeExists(orderCode)) && attempts < 5) {
      orderCode = generateOrderCode()
      attempts++
    }
    if (attempts >= 5) {
      throw new AppError({ code: "ORDER_CODE_COLLISION" })
    }

    // 2. Fetch de datos estáticos (nombres, SKUs, imágenes)
    // const productIds = [...new Set(cart.items.map((i) => i.productId))]
    const variantIds = [...new Set(cart.items.filter((i) => i.variantId).map((i) => i.variantId!))]

    // 2. Fetch de datos estáticos en UNA sola llamada (asumiendo que todo es una variante)
    // const variantIds = [...new Set(cart.items.map((i) => i.variantId))];

    // Este método nuevo en ProductsRepo te trae las variantes con su producto anidado
    const variantsMap = await this.productsRepo.findVariantsWithProductParent(variantIds)
    // const [productsMap, variantsMap] = await Promise.all([
    //   this.productsRepo.findActiveProductsByIds(productIds),
    //   this.productsRepo.findVariantsByIds(variantIds)
    // ])

    // 3. Procesar items SIN recalcular precios (ya vienen en item.pricing)
    const processedItems = cart.items.map((item) => {
      const variantData = variantsMap[item.variantId]
      if (!variantData) throw new AppError({ code: "PRODUCT_NOT_FOUND" })

      const product = variantData.product

      // const product = productsMap[item.productId]
      // if (!product)
      //   throw new AppError({
      //     code: "PRODUCT_NOT_FOUND",
      //     message: `Producto ${item.productId} no disponible`
      //   })

      // Las reglas ya se validaron al meterlos al carrito, pero revalidamos por seguridad
      if (product.purchaseRules) {
        const rulesValidation = validatePurchaseRules(item.quantity, product.purchaseRules)
        if (!rulesValidation.valid) {
          throw new AppError({
            code: "ORDER_INVALID_QUANTITY",
            message: `Cantidad inválida para ${product.name}: ${rulesValidation.error}`,
            statusCode: 400
          })
        }
      }

      return buildOrderItemSnapshot({
        product: {
          id: product.id,
          name: product.name,
          // sku: product.sku ?? "",
          image: product.images?.[0]?.url ?? "",
          purchaseRules: product.purchaseRules
        },
        variant: {
          id: variantData.id,
          name: variantData.name,
          sku: variantData.sku,
          image: variantData.image ?? product.images?.[0]?.url ?? ""
        },
        pricing: item.pricing,
        quantity: item.quantity
      })
    })

    // 4. calcular totales de la orden (función pura)
    const lineSubtotals = processedItems.map((i) => i.lineSubtotal)
    const totals = calculateOrderTotals({
      lineSubtotals,
      discounts: "0", // TODO: aplicar descuentos globales
      shippingCost: input.deliveryType === "shipping" ? "0" : "0", // TODO: lógica de shipping pendiente
      taxes: "0" // TODO: integrar módulo de taxes
    })

    // 5. ejecutar en transacción para atomicidad
    const created = await this.ordersRepo.createOrder({
      orderCode,
      userId,
      cartIdToConvert: cart.id,
      deliveryType: input.deliveryType,
      shippingData: input.shippingData,
      billingData: input.billingData,
      pickupLocationData: input.pickupLocationData,
      subtotal: totals.subtotal,
      discounts: totals.discounts,
      shippingCost: totals.shippingCost,
      taxes: totals.taxes,
      total: totals.total,
      observations: input.observations,
      items: processedItems
    })

    await this.notificationService.notifyNewOrder(
      {
        orderCode: created.orderCode,
        total: totals.total,
        deliveryType: created.deliveryType,
        pickupLocationData: created.pickupLocationData
      },
      created.userEmail
    )

    return {
      orderId: created.orderId,
      orderCode: created.orderCode,
      total: totals.total
    }
  }

  // Para el cliente final
  async getCustomerOrder(orderId: string, userId: string) {
    const order = await this.ordersRepo.getOrderById(orderId, {
      userId,
      includeTimeline: false,
      includeDeleted: false
    })

    // ¡La validación de seguridad más importante!
    if (!order || order.userId !== userId) {
      // Lanzamos 404 en lugar de 403 para que un atacante no pueda escanear IDs válidos
      throw new AppError({
        code: "ORDER_NOT_FOUND",
        statusCode: 404
      })
    }

    return order
  }

  // Para el administrador
  async getAdminOrder(orderId: string) {
    const order = await this.ordersRepo.getOrderById(orderId, {
      includeTimeline: true,
      includeDeleted: true
    })

    if (!order) {
      throw new AppError({
        code: "ORDER_NOT_FOUND"
      })
    }

    return order
  }

  /**
   * Lista órdenes con filtros y paginación
   */
  async getOrders(filters: GetOrdersFilters): Promise<GetOrdersResult> {
    return await this.ordersRepo.getOrders(filters)
  }

  /**
   * Cambia el estado de una orden y registra el evento en el timeline
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string, // userId o 'admin'
    meta?: { reason?: string; adminNote?: string; isCustomer?: boolean }
  ) {
    // Obtener estado actual
    const order = await this.ordersRepo.getOrderById(orderId)
    if (!order) {
      throw new AppError({ code: "ORDER_NOT_FOUND" })
    }

    // Guardia: Si el que cancela es el cliente, solo puede hacerlo en ciertos estados
    if (newStatus === "cancelled" && meta?.isCustomer) {
      if (!["pending", "pending_payment"].includes(order.status)) {
        throw new AppError({
          code: "ORDER_NOT_CANCELLABLE"
        })
      }
    }

    // Validar transición de estados
    const error = getStatusTransitionError(order.status, newStatus)
    if (error) {
      throw new AppError({ code: "ORDER_INVALID_TRANSITION" })
    }

    // Si se cancela, validar que haya motivo
    if (newStatus === "cancelled" && !meta?.reason) {
      throw new AppError({ code: "ORDER_MISSING_REASON" })
    }

    // Actualizar en repo (esto ya registra en timeline)
    const result = await this.ordersRepo.updateOrderStatus(orderId, newStatus, changedBy, {
      ...meta,
      previousStatus: order.status
    })

    // Si se cancela, actualizar campos de cancelación en orders (ddd: repo maneja DB)
    if (newStatus === "cancelled") {
      await this.ordersRepo.updateOrderCancellationFields(
        orderId,
        meta?.reason ?? "Sin motivo",
        changedBy
      )
    }

    try {
      // Necesitás el email del usuario para notificarle
      const user = await usersRepository.findById(order.userId)
      if (user) {
        if (newStatus === "pending_payment") {
          // El admin ajustó todo y le dice al cliente: "Acá está el CBU/Link para pagar"
          await this.notificationService.notifyPaymentRequired(
            {
              orderCode: order.orderCode,
              total: order.total
            },
            user.email,
            meta?.adminNote
          )
        } else if (newStatus === "paid") {
          // Pago confirmado
          await this.notificationService.notifyOrderPaid(
            {
              orderCode: order.orderCode
            },
            user.email
          )
        } else if (newStatus === "shipped" || newStatus === "ready_pickup") {
          // Despachado o listo para retirar
          // TODO: Implementar notificación de despacho
          // await this.notificationService.notifyOrderDispatched(order, user.email, meta?.adminNote)
        } else if (newStatus === "cancelled") {
          // Cancelado (por cliente o admin)
          await this.notificationService.notifyOrderCancelled(
            {
              orderCode: order.orderCode
            },
            user.email,
            meta?.reason
          )
        }
      }
    } catch (error) {
      console.error(
        `Error enviando notificación de estado ${newStatus} para orden ${orderId}:`,
        error
      )
    }

    return {
      orderId,
      previousStatus: order.status,
      newStatus,
      updatedAt: result.updatedAt
    }
  }

  /**
   * Agrega nota interna (solo admin)
   */
  async addInternalNote(
    orderId: string,
    admin: { id: string; name: string },
    content: string,
    type?: InternalNote["type"]
  ) {
    if (!content.trim()) {
      throw new AppError({
        code: "custom",
        message: "El contenido de la nota no puede estar vacío",
        statusCode: 400
      })
    }

    await this.ordersRepo.addInternalNote(orderId, {
      content: content.trim(),
      createdBy: admin,
      type
    })

    return { success: true }
  }
}

export const ordersService = new OrdersService(
  ordersRepository,
  cartsService,
  productsRepository,
  notificationService
)
