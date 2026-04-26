import { buildOrderItemSnapshot, isValidPickupSchedule } from "../lib/orders.utils"
import { type OrdersRepository, ordersRepository } from "../orders.repository"
import { type OrdersAdjustingRepository, ordersAdjustingRepository } from "./adjusting.repository"
import type { PickupLocationData } from "@/db/pg/orders.types"
import type { UserRole } from "@/types/fastify"
import type { AddressData } from "../orders.types"

import { getTierFromRole, validatePurchaseRules } from "@/domains/products/lib/pricing.utils"
import {
  type ProductsPricingService,
  productsPricingService
} from "@/domains/products/pricing/pricing.service"
import { type ProductsRepository, productsRepository } from "@/domains/products/products.repository"
import { usersRepository } from "@/domains/users/users.repository"
import { AppError } from "@/utils/app-error"

export class OrdersAdjustingService {
  constructor(
    private readonly ordersRepo: OrdersRepository,
    private readonly ordersAdjustingRepo: OrdersAdjustingRepository,
    private readonly productsRepo: ProductsRepository,
    private readonly pricingService: ProductsPricingService
  ) {}

  /**
   * Agrega un item a pedido existente (admin)
   * Valida stock, calcula precio, crea snapshot
   */
  async addOrderItem(
    orderId: string,
    itemInput: { productId: string; variantId: string; quantity: number },
    admin: { id: string; role: UserRole; name?: string }
  ) {
    // 1. Obtener pedido actual
    const order = await this.ordersRepo.getOrderById(orderId)
    if (!order) throw new AppError({ code: "ORDER_NOT_FOUND" })

    // 2. Validar estado editable
    if (!["pending", "adjusting", "pending_payment"].includes(order.status)) {
      throw new AppError({ code: "ORDER_NOT_EDITABLE" })
    }

    // 3. found tier user of order
    const user = await usersRepository.findById(order.userId)
    if (!user) {
      throw new AppError({ code: "custom", message: "Usuario no encontrado", statusCode: 404 })
    }
    const userTier = getTierFromRole(user.role)

    // 4. calcular precio con pricing service
    const pricing = await this.pricingService.calculatePrice({
      productId: itemInput.productId,
      variantId: itemInput.variantId,
      userTier: userTier,
      quantity: itemInput.quantity
    })

    // 5. search for purchase rules of product..
    const product = await this.productsRepo.findProductWithDetails(itemInput.productId)
    if (!product)
      throw new AppError({ code: "custom", message: "Producto no encontrado", statusCode: 404 })

    const variant = itemInput.variantId
      ? product.variants.find((v) => v.id === itemInput.variantId)
      : null

    // 6. Validar reglas de compra
    const rulesValidation = validatePurchaseRules(itemInput.quantity, product.purchaseRules)
    if (!rulesValidation.valid) {
      throw new AppError({ code: "ORDER_INVALID_QUANTITY" })
    }

    // 7. Preparar snapshot del item
    const snapshotItem = buildOrderItemSnapshot({
      product: {
        id: product.id,
        name: product.name,
        image: product.primaryImage?.url ?? "",
        purchaseRules: product.purchaseRules ?? null
      },
      variant: variant
        ? {
            id: variant.id,
            name: variant.name,
            sku: variant.sku,
            image: variant.image ?? product.primaryImage?.url ?? ""
          }
        : null,
      pricing,
      quantity: itemInput.quantity
    })

    // 8. Ejecutar en transacción: agregar item + recalcular totales
    const { itemId, newTotal } = await this.ordersAdjustingRepo.addOrderItem(
      orderId,
      snapshotItem,
      admin.id
    )

    return { success: true, itemId, newTotal }
  }

  /**
   * Aplica descuento/recargo manual a orden completa
   */
  async applyManualAdjustment(
    orderId: string,
    adjustment: string, // "-25.00" o "+10.00"
    reason: string,
    admin: { id: string; name: string },
    notifyCustomer: boolean = false
  ) {
    // Validar que el adjustment sea número válido
    const adjValue = parseFloat(adjustment)
    if (Number.isNaN(adjValue)) {
      throw new AppError({
        code: "custom",
        message: "El ajuste debe ser un número válido",
        statusCode: 400
      })
    }

    const result = await this.ordersAdjustingRepo.applyManualAdjustment(
      orderId,
      adjustment,
      reason,
      admin.id
    )

    // Si se solicita, registrar nota para notificación al cliente
    if (notifyCustomer) {
      await this.ordersRepo.addInternalNote(orderId, {
        content: `Ajuste de precio aplicado: ${adjustment}. Motivo: ${reason}. Cliente será notificado.`,
        createdBy: admin,
        type: "customer"
      })
      // Aquí podrías disparar email/WhatsApp si tenés un servicio de notificaciones
    }

    return { success: true, newTotal: result.newTotal }
  }

  /**
   * Cambia tipo de entrega (shipping ↔ pickup)
   */
  async changeDeliveryType(
    orderId: string,
    newType: "shipping" | "pickup",
    newData: { shippingData?: AddressData; pickupLocationData?: PickupLocationData },
    admin: { id: string; name: string }
  ) {
    // Validaciones básicas
    if (newType === "pickup" && !newData.pickupLocationData) {
      throw new AppError({
        code: "custom",
        message: "Debe especificar sucursal y horario para retiro",
        statusCode: 400
      })
    }
    if (newType === "shipping" && !newData.shippingData) {
      throw new AppError({
        code: "custom",
        message: "Debe especificar dirección de envío",
        statusCode: 400
      })
    }
    if (newData.pickupLocationData) {
      const { scheduledDate, scheduledTime } = newData.pickupLocationData
      if (!isValidPickupSchedule(scheduledDate, scheduledTime)) {
        throw new AppError({
          code: "custom",
          message: "Fecha/hora de retiro inválida",
          statusCode: 400
        })
      }
    }

    // Validar costo de envío si cambia a shipping (lógica pendiente de módulo de shipping)
    // Por ahora, shippingCost = 0, se puede ajustar después

    await this.ordersAdjustingRepo.updateDeliveryType(orderId, newType, newData, admin.id)

    // Si el cambio afecta el precio (ej: agregar costo de envío), recalcular totales
    // ... (lógica similar a addOrderItem)

    return { success: true, newDeliveryType: newType }
  }

  /**
   * Actualiza la cantidad de un item existente
   */
  async updateOrderItemQuantity(
    orderId: string,
    itemId: string,
    newQuantity: number,
    admin: { id: string; role: string }
  ) {
    const order = await this.ordersRepo.getOrderById(orderId, { includeTimeline: false })
    if (!order) throw new AppError({ code: "ORDER_NOT_FOUND" })

    if (!["pending", "adjusting", "pending_payment"].includes(order.status)) {
      throw new AppError({ code: "ORDER_NOT_EDITABLE" })
    }

    // Buscar el item en la orden
    const itemToUpdate = order.items.find((i) => i.id === itemId)
    if (!itemToUpdate) throw new AppError({ code: "ITEM_NOT_FOUND" })

    // Obtener el tier del usuario para recalcular el precio correcto
    const user = await usersRepository.findById(order.userId)
    const userTier = user ? getTierFromRole(user.role) : "retail"

    // Validar reglas de compra (mínimos, máximos, múltiplos)
    const product = await this.productsRepo.findProductWithDetails(itemToUpdate.productId)
    if (product) {
      const rulesValidation = validatePurchaseRules(newQuantity, product.purchaseRules)
      if (!rulesValidation.valid) {
        throw new AppError({ code: "ORDER_INVALID_QUANTITY", message: rulesValidation.error })
      }
    }

    // Recalcular precio con la nueva cantidad (por si hay descuentos por volumen)
    const pricing = await this.pricingService.calculatePrice({
      productId: itemToUpdate.productId,
      variantId: itemToUpdate.variantId ?? undefined,
      userTier,
      quantity: newQuantity
    })

    const result = await this.ordersAdjustingRepo.updateOrderItemQuantity(
      orderId,
      itemId,
      newQuantity,
      pricing.finalSubtotal.toString(),

      /***
       Respecto a estar pasando de number a string: No hay ningún problema, de hecho, es la práctica estándar y correcta. ¿Por qué? Porque en JavaScript los números de punto flotante (0.1 + 0.2 = 0.30000000000000004) son peligrosos para dinero. Drizzle/MySQL devuelven los campos DECIMAL como string justamente para no perder precisión. Entonces, haces los cálculos matemáticos en tu PricingService (asegurándote de redondear como ya haces con Math.round) y, al momento de enviarlo a la base de datos, lo pasas a string.
       * 
       */
      admin.id
    )

    return { success: true, newTotal: result.newTotal }
  }

  /**
   * Elimina un item de la orden
   */
  async removeOrderItem(orderId: string, itemId: string, admin: { id: string }) {
    const order = await this.ordersRepo.getOrderById(orderId)
    if (!order) throw new AppError({ code: "ORDER_NOT_FOUND" })

    if (!["pending", "adjusting", "pending_payment"].includes(order.status)) {
      throw new AppError({ code: "ORDER_NOT_EDITABLE" })
    }

    // Validar que no estemos borrando el último item (una orden no puede tener 0 items)
    if (order.items.length <= 1) {
      throw new AppError({
        code: "ORDER_CANNOT_BE_EMPTY"
      })
    }

    const result = await this.ordersAdjustingRepo.removeOrderItem(orderId, itemId, admin.id)
    return { success: true, newTotal: result.newTotal }
  }
}

export const adjustingService = new OrdersAdjustingService(
  ordersRepository,
  ordersAdjustingRepository,
  productsRepository,
  productsPricingService
)
