import { and, eq } from "drizzle-orm"
import { calculateOrderTotals } from "../lib/orders.utils"
import type { DeliveryType, PickupLocationData, ShippingData } from "@/db/pg/orders.types"
import type { CreateOrderItemInput } from "../orders.types"

import { type Database, db } from "@/db"
import { orderItems, orders, orderTimeline } from "@/db/pg"
import { AppError } from "@/utils/app-error"

export class OrdersAdjustingRepository {
  private database: Database
  constructor(database?: Database) {
    this.database = database ?? db
  }

  /**
   * Agrega un nuevo item a una orden existente (con snapshot) + actualiza los totales
   * Solo para estado "adjusting" o "pending"
   */
  async addOrderItem(
    orderId: string,
    itemInput: CreateOrderItemInput, // Omit<OrderItemInsert, "orderId">,
    changedBy: string, // userId o adminId
    trx?: Database
  ): Promise<{ itemId: string; newTotal: string }> {
    const queryDb = trx ?? this.database

    // Validar que la orden exista y esté en estado editable
    const [order] = await queryDb
      .select({
        id: orders.id,
        status: orders.status,
        discounts: orders.discounts,
        shippingCost: orders.shippingCost,
        taxes: orders.taxes
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order || !["pending", "adjusting", "pending_payment"].includes(order.status)) {
      throw new AppError({
        code: "ORDER_NOT_EDITABLE",
        message: "No se pueden agregar items en este estado"
      })
    }

    // transacción para atomicidad: insertar item + recalcular totales + timeline
    const result = await queryDb.transaction(async (trx) => {
      const [newItem] = await trx
        .insert(orderItems)
        .values({
          orderId,
          ...itemInput,
          volumeDiscountApplied: itemInput.volumeDiscountApplied ?? "0"
        })
        .returning()

      if (!newItem?.id) {
        throw new AppError({ code: "custom", message: "No se pudo agregar el item" })
      }

      // update totals (recalculate)
      const items = await trx
        .select({ lineSubtotal: orderItems.lineSubtotal })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      const lineSubtotals = items.map((i) => i.lineSubtotal)
      const totals = calculateOrderTotals({
        lineSubtotals,
        discounts: order.discounts ?? "0",
        shippingCost: order.shippingCost ?? "0",
        taxes: order.taxes ?? "0"
      })

      // Actualizar orden con nuevos totales
      await trx
        .update(orders)
        .set({
          subtotal: totals.subtotal,
          total: totals.total,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))

      // registrar en timeline
      await trx.insert(orderTimeline).values({
        orderId,
        eventType: "items_adjusted",
        changedBy,
        metadata: {
          action: "item_added",
          item: {
            id: newItem.id,
            productName: itemInput.productName,
            quantity: itemInput.quantity,
            unitPrice: itemInput.unitPrice,
            lineSubtotal: itemInput.lineSubtotal
          },
          priceDiff: itemInput.lineSubtotal,
          newTotal: totals.total
        }
      })
      return {
        itemId: newItem.id,
        newTotal: totals.total
      }
    })

    return result
  }

  /**
   * Aplica ajuste manual de precio a la orden completa
   */
  async applyManualAdjustment(
    orderId: string,
    adjustment: string, // "+50.00" o "-30.00"
    reason: string,
    changedBy: string,
    trx?: Database
  ): Promise<{ newTotal: string }> {
    const queryDb = trx ?? this.database

    const [order] = await queryDb
      .select({
        total: orders.total,
        subtotal: orders.subtotal,
        discounts: orders.discounts,
        shippingCost: orders.shippingCost,
        taxes: orders.taxes,
        manualAdjustment: orders.manualAdjustment
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      throw new AppError({ code: "ORDER_NOT_FOUND" })
    }

    // Calcular nuevo total: subtotal - discounts + shipping + taxes + (manualAdjustment + newAdjustment)
    const prevManual = parseFloat(order.manualAdjustment ?? "0")
    const newAdjustment = parseFloat(adjustment)
    const newManual = (prevManual + newAdjustment).toFixed(2)

    const subtotal = parseFloat(order.subtotal)
    const discounts = parseFloat(order.discounts ?? "0")
    const shipping = parseFloat(order.shippingCost ?? "0")
    const taxes = parseFloat(order.taxes ?? "0")

    const newTotal = (subtotal - discounts + shipping + taxes + parseFloat(newManual)).toFixed(2)

    await queryDb
      .update(orders)
      .set({
        manualAdjustment: newManual,
        total: newTotal,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))

    await queryDb.insert(orderTimeline).values({
      orderId,
      eventType: "price_adjusted",
      changedBy,
      metadata: {
        adjustment,
        reason,
        previousManualAdjustment: order.manualAdjustment,
        newManualAdjustment: newManual,
        previousTotal: order.total,
        newTotal
      }
    })

    return { newTotal }
  }

  /**
   * Cambia el tipo de entrega y actualiza datos asociados
   */
  async updateDeliveryType(
    orderId: string,
    newType: "shipping" | "pickup",
    newData: { shippingData?: ShippingData; pickupLocationData?: PickupLocationData },
    changedBy: string,
    trx?: Database
  ): Promise<void> {
    const queryDb = trx ?? this.database

    const [order] = await queryDb
      .select({ status: orders.status, deliveryType: orders.deliveryType })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1)

    if (!order) {
      throw new AppError({ code: "ORDER_NOT_FOUND" })
    }

    if (!["pending", "adjusting", "pending_payment"].includes(order.status)) {
      throw new AppError({ code: "ORDER_NOT_EDITABLE" })
    }

    const updateData: {
      deliveryType: DeliveryType
      shippingData?: ShippingData | null
      pickupLocationData?: PickupLocationData | null
      updatedAt: Date
    } = {
      deliveryType: newType,
      updatedAt: new Date()
    }

    // Limpiar datos del tipo anterior y establecer los nuevos
    if (newType === "shipping") {
      updateData.shippingData = newData.shippingData
      updateData.pickupLocationData = null
    } else {
      updateData.pickupLocationData = newData.pickupLocationData
      updateData.shippingData = null // Opcional: mantener billingData siempre
    }

    await queryDb.update(orders).set(updateData).where(eq(orders.id, orderId))

    await queryDb.insert(orderTimeline).values({
      orderId,
      eventType: "delivery_updated",
      changedBy,
      metadata: {
        fromType: order.deliveryType,
        toType: newType,
        reason:
          newData.shippingData?.notes ?? newData.pickupLocationData?.notes ?? "Cambio solicitado"
      }
    })
  }

  /**
   * Actualiza la cantidad de un item y recalcula totales
   */
  async updateOrderItemQuantity(
    orderId: string,
    itemId: string,
    newQuantity: number,
    newLineSubtotal: string,
    changedBy: string,
    trx?: Database
  ): Promise<{ newTotal: string }> {
    const queryDb = trx ?? this.database

    return await queryDb.transaction(async (tx) => {
      // 1. Actualizar el item
      await tx
        .update(orderItems)
        .set({
          quantity: newQuantity,
          lineSubtotal: newLineSubtotal,
          updatedAt: new Date()
        })
        .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))

      // 2. Obtener la orden y todos los items para recalcular
      const [order] = await tx
        .select({
          discounts: orders.discounts,
          shippingCost: orders.shippingCost,
          taxes: orders.taxes,
          manualAdjustment: orders.manualAdjustment
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)

      const items = await tx
        .select({ lineSubtotal: orderItems.lineSubtotal })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      // 3. Recalcular
      const lineSubtotals = items.map((i) => i.lineSubtotal)
      const totals = calculateOrderTotals({
        lineSubtotals,
        discounts: order.discounts ?? "0",
        shippingCost: order.shippingCost ?? "0",
        taxes: order.taxes ?? "0"
      })

      // Considerar el manualAdjustment para el total final
      const finalTotal = (
        parseFloat(totals.total) + parseFloat(order.manualAdjustment ?? "0")
      ).toFixed(2)

      // 4. Actualizar orden
      await tx
        .update(orders)
        .set({
          subtotal: totals.subtotal,
          total: finalTotal,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))

      // 5. Timeline
      await tx.insert(orderTimeline).values({
        orderId,
        eventType: "items_adjusted",
        changedBy,
        metadata: {
          action: "item_quantity_updated",
          itemId,
          newQuantity,
          newTotal: finalTotal
        }
      })

      return { newTotal: finalTotal }
    })
  }

  /**
   * Elimina un item de la orden y recalcula totales
   */
  async removeOrderItem(
    orderId: string,
    itemId: string,
    changedBy: string,
    trx?: Database
  ): Promise<{ newTotal: string }> {
    const queryDb = trx ?? this.database

    return await queryDb.transaction(async (tx) => {
      await tx
        .delete(orderItems)
        .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))

      // Misma lógica de recalculo que arriba
      const [order] = await tx
        .select({
          discounts: orders.discounts,
          shippingCost: orders.shippingCost,
          taxes: orders.taxes,
          manualAdjustment: orders.manualAdjustment
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1)

      const items = await tx
        .select({ lineSubtotal: orderItems.lineSubtotal })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      const lineSubtotals = items.map((i) => i.lineSubtotal)
      const totals = calculateOrderTotals({
        lineSubtotals,
        discounts: order.discounts ?? "0",
        shippingCost: order.shippingCost ?? "0",
        taxes: order.taxes ?? "0"
      })

      const finalTotal = (
        parseFloat(totals.total) + parseFloat(order.manualAdjustment ?? "0")
      ).toFixed(2)

      await tx
        .update(orders)
        .set({
          subtotal: totals.subtotal,
          total: finalTotal,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId))

      await tx.insert(orderTimeline).values({
        orderId,
        eventType: "items_adjusted",
        changedBy,
        metadata: {
          action: "item_removed",
          itemId,
          newTotal: finalTotal
        }
      })

      return { newTotal: finalTotal }
    })
  }
}

export const ordersAdjustingRepository = new OrdersAdjustingRepository()
