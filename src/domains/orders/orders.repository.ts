import { createId } from "@paralleldrive/cuid2"
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import type {
  BillingData,
  DeliveryType,
  InternalNote,
  OrderStatus,
  PickupLocationData,
  ShippingData
} from "@/db/pg/orders.types"
import type { CreateOrderInput, GetOrdersFilters, OrderWithItems } from "./orders.types"

import { type Database, db } from "@/db"
import { carts } from "@/db/pg"
import { orderItems, orders, orderTimeline } from "@/db/pg/orders"
import { AppError } from "@/utils/app-error"

export class OrdersRepository {
  /**
   * Crea orden + items + evento inicial en timeline (con transacción)
   */
  async createOrder(
    input: CreateOrderInput,
    trx?: Database
  ): Promise<{
    orderId: string
    orderCode: string
    deliveryType: DeliveryType
    pickupLocationData: PickupLocationData | null
    userEmail: string
  }> {
    const queryDb = trx ?? db

    return await queryDb.transaction(async (trx) => {
      // a. crear la orden principal
      const [order] = await trx
        .insert(orders)
        .values({
          orderCode: input.orderCode,
          userId: input.userId,
          deliveryType: input.deliveryType,
          shippingData: input.shippingData,
          billingData: input.billingData,
          pickupLocationData: input.pickupLocationData,
          subtotal: input.subtotal,
          discounts: input.discounts ?? "0",
          shippingCost: input.shippingCost ?? "0",
          taxes: input.taxes ?? "0",
          total: input.total,
          observations: input.observations
        })
        .returning()

      if (!order?.id) {
        throw new AppError({ code: "ORDER_CREATE_FAILED" })
      }

      // b. crear los items con snapshot estático
      if (input.items.length > 0) {
        const itemsToInsert = input.items.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          // productSku: item.productSku,
          productImage: item.productImage,
          variantName: item.variantName,
          // variantSku: item.variantSku,
          unitPrice: item.unitPrice,
          compareAtPrice: item.compareAtPrice,
          tierType: item.tierType,
          quantity: item.quantity,
          volumeDiscountApplied: item.volumeDiscountApplied ?? "0",
          lineSubtotal: item.lineSubtotal,
          purchaseRules: item.purchaseRules,
          metadata: item.metadata
        }))

        await trx.insert(orderItems).values(itemsToInsert)
      }

      // c. registrar evento inicial en timeline
      await trx.insert(orderTimeline).values({
        orderId: order.id,
        eventType: "order_created",
        changedBy: input.userId, // o 'system' si es automático
        metadata: {
          itemsCount: input.items.length,
          deliveryType: input.deliveryType,
          total: input.total
        }
      })

      // d. marcar el carrito como "convertido" (para no volver a usarlo)
      await trx
        .update(carts)
        .set({ status: "converted", updatedAt: new Date() })
        .where(eq(carts.id, input.cartIdToConvert))

      // get new order
      const newOrder = await trx.query.orders.findFirst({
        where: eq(orders.id, order.id),
        with: {
          user: true
        }
      })

      if (!newOrder) {
        throw new AppError({ code: "ORDER_NOT_FOUND" })
      }

      return {
        orderId: newOrder.id,
        orderCode: newOrder.orderCode,
        deliveryType: newOrder.deliveryType,
        pickupLocationData: newOrder.pickupLocationData,
        userEmail: newOrder.user?.email
      }
    })
  }

  /**
   * Obtiene orden por ID con items y timeline opcional
   */
  async getOrderById(
    orderId: string,
    options?: { includeTimeline?: boolean; includeDeleted?: boolean; userId?: string }
  ): Promise<OrderWithItems | null> {
    const { includeTimeline = false, includeDeleted = false, userId } = options ?? {}

    const conditions = [eq(orders.id, orderId)]
    if (!includeDeleted) conditions.push(isNull(orders.deletedAt))
    if (userId) conditions.push(eq(orders.userId, userId))

    const order = await db.query.orders.findFirst({
      where: and(...conditions),
      with: {
        items: true,
        // agregamos el timeline dinámicamente si se solicita
        ...(includeTimeline && {
          timeline: {
            orderBy: (timeline, { asc }) => [asc(timeline.createdAt)]
          }
        })
      }
    })
    return order ?? null
  }

  /**
   * Lista órdenes con filtros y paginación
   */
  async getOrders(filters: GetOrdersFilters = {}): Promise<{
    orders: (typeof orders.$inferSelect)[]
    total: number
    hasMore: boolean
  }> {
    const {
      userId,
      status,
      deliveryType,
      startDate,
      endDate,
      search,
      limit = 20,
      offset = 0,
      orderBy = "createdAt",
      orderDir = "desc"
    } = filters

    // construir condiciones WHERE dinámicas
    const conditions = [isNull(orders.deletedAt)]

    if (userId) conditions.push(eq(orders.userId, userId))

    if (status) {
      const statuses = Array.isArray(status) ? status : [status]
      conditions.push(inArray(orders.status, statuses))
    }

    if (deliveryType) conditions.push(eq(orders.deliveryType, deliveryType))
    if (startDate) conditions.push(sql`${orders.createdAt} >= ${startDate}`)
    if (endDate) conditions.push(sql`${orders.createdAt} <= ${endDate}`)

    if (search) {
      // buscar por orderCode (char(8)) o orderNumber (serial)
      const searchNum = parseInt(search, 10)
      if (!Number.isNaN(searchNum)) {
        conditions.push(eq(orders.orderNumber, searchNum))
      } else {
        conditions.push(eq(orders.orderCode, search.toUpperCase()))
      }
    }

    // query principal con paginación
    const data = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(orderDir === "asc" ? asc(orders[orderBy]) : desc(orders[orderBy]))
      .limit(limit + 1) // +1 para detectar si hay más páginas
      .offset(offset)

    // conteo total para paginación
    const [{ total }] = await db
      .select({ total: count() })
      .from(orders)
      .where(and(...conditions))

    const hasMore = data.length > limit
    const paginated = hasMore ? data.slice(0, limit) : data

    return {
      orders: paginated,
      total,
      hasMore
    }
  }

  /**
   * Cambia estado de orden + registra en timeline
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string, // userId o 'admin' o 'system'
    metadata?: Record<string, unknown>
  ): Promise<{ previousStatus: OrderStatus; updatedAt: Date }> {
    // Obtener estado actual
    const [current] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!current) throw new AppError({ code: "ORDER_NOT_FOUND" })

    const previousStatus = current.status

    // actualizar estado
    await db
      .update(orders)
      .set({
        status: newStatus
        // si se cancela, se deben llenar campos de cancelación (se maneja en service)
      })
      .where(eq(orders.id, orderId))

    // registrar evento en timeline
    await db.insert(orderTimeline).values({
      orderId,
      eventType: "status_changed",
      fromStatus: previousStatus,
      toStatus: newStatus,
      changedBy,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    })

    // obtener timestamp actualizado
    const [updated] = await db
      .select({ updatedAt: orders.updatedAt })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    return {
      previousStatus,
      updatedAt: updated?.updatedAt ?? new Date()
    }
  }

  /**
   * Actualiza campos de cancelación (solo para status = "cancelled")
   */
  async updateOrderCancellationFields(
    orderId: string,
    cancelReason: string,
    cancelledBy: string
  ): Promise<void> {
    await db
      .update(orders)
      .set({
        cancelReason,
        cancelledBy,
        cancelledAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
  }

  /**
   * Agrega nota interna + registra en timeline (solo admin)
   */
  async addInternalNote(
    orderId: string,
    note: Omit<InternalNote, "id" | "createdAt">
  ): Promise<void> {
    const [order] = await db
      .select({ internalNotes: orders.internalNotes })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) throw new AppError({ code: "ORDER_NOT_FOUND" })

    const newNote: InternalNote = {
      ...note,
      id: createId(),
      createdAt: new Date()
    }

    const currentNotes = order.internalNotes ?? []
    const updatedNotes = [...currentNotes, newNote]

    await db.update(orders).set({ internalNotes: updatedNotes }).where(eq(orders.id, orderId))

    // registrar en timeline para auditoría
    await db.insert(orderTimeline).values({
      orderId,
      eventType: "admin_note",
      changedBy: note.createdBy.id,
      metadata: {
        noteType: note.type,
        notePreview: note.content.slice(0, 100)
      }
    })
  }

  /**
   * Actualiza datos de envío/retiro (solo antes de "paid")
   */
  async updateDeliveryData(
    orderId: string,
    updates: {
      shippingData?: ShippingData
      billingData?: BillingData
      pickupLocationData?: PickupLocationData
    }
  ): Promise<void> {
    // Validar que la orden esté en estado editable
    const [order] = await db
      .select({ status: orders.status, deliveryType: orders.deliveryType })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      throw new AppError({
        code: "ORDER_NOT_FOUND"
      })
    }

    // No permitir editar si ya está en proceso de envío/entrega
    const editableStatuses: OrderStatus[] = ["pending", "adjusting", "pending_payment"]
    if (!editableStatuses.includes(order.status)) {
      throw new AppError({
        code: "ORDER_NOT_EDITABLE",
        message: `No se pueden modificar datos de entrega en estado "${order.status}"`
      })
    }

    await db
      .update(orders)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
  }

  /**
   * Soft delete: marcar orden como eliminada (solo admin)
   */
  async softDelete(orderId: string, deletedBy: string): Promise<void> {
    await db
      .update(orders)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))

    await db.insert(orderTimeline).values({
      orderId,
      eventType: "cancelled", // Reusamos evento de cancelación para auditoría
      changedBy: deletedBy,
      metadata: { reason: "soft_delete_admin", action: "hidden_from_user" }
    })
  }

  /**
   * Verifica si un orderCode ya existe
   */
  async orderCodeExists(orderCode: string): Promise<boolean> {
    const [result] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderCode, orderCode))
      .limit(1)

    return !!result
  }
}

export const ordersRepository = new OrdersRepository()
