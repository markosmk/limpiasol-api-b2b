import {
  type ProductsPricingService,
  productsPricingService
} from "../products/pricing/pricing.service"
import { type CartsRepository, cartsRepository } from "./carts.repository"
import type { UserTier } from "../products/pricing/pricing.types"
import type { AddToCartInput } from "./carts.schema"

import { AppError } from "@/utils/app-error"

export class CartsService {
  constructor(
    private readonly cartsRepo: CartsRepository,
    private readonly pricingService: ProductsPricingService
  ) {}

  async getOrCreateActiveCart(userId: string) {
    let cart = await this.cartsRepo.findActiveCartByUserId(userId)
    if (!cart) {
      cart = await this.cartsRepo.createCart(userId)
    }
    return cart
  }

  async getActiveCartHydrated(userId: string, userTier: string) {
    // 1. Obtenemos el carrito crudo de la BD
    const cart = await this.getOrCreateActiveCart(userId)

    // 2. Si no hay items, retornamos con subtotal 0
    if (!cart?.items || cart.items.length === 0) {
      return { ...cart, subtotal: 0, items: [] }
    }

    let subtotal = 0

    // 3. Hidratamos cada ítem con su precio dinámico
    const hydratedItems = await Promise.all(
      cart.items.map(async (item) => {
        const pricing = await this.pricingService.calculatePrice({
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          userTier: userTier as UserTier,
          quantity: item.quantity
        })

        subtotal += pricing.finalSubtotal

        return {
          ...item,
          pricing // Agregamos el objeto de pricing al item
        }
      })
    )

    // 4. Retornamos el carrito completo con el subtotal calculado
    return {
      ...cart,
      items: hydratedItems,
      subtotal: Math.round(subtotal * 100) / 100 // Prevenir errores de punto flotante en JS
    }
  }

  async addItem(userId: string, data: AddToCartInput, userTier: UserTier) {
    // 1. Validar reglas de compra ANTES de hacer nada
    const validation = await this.pricingService.validateQuantity(
      data.productId,
      data.quantity,
      data.variantId
    )

    if (!validation.valid) {
      throw new AppError({
        code: "custom",
        message: validation.error,
        statusCode: 400
      })
    }

    // 1. Obtener o crear carrito activo
    const cart = await this.getOrCreateActiveCart(userId)
    if (!cart)
      throw new AppError({
        code: "custom",
        message: "No se pudo crear el carrito",
        statusCode: 500
      })

    // 2. Insertar o actualizar item
    await this.cartsRepo.upsertCartItem(cart.id, data.productId, data.variantId, data.quantity)

    // 3. Retornar carrito actualizado
    return this.getActiveCartHydrated(userId, userTier)
  }

  async updateItemQuantity(
    userId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number,
    userTier: UserTier
  ) {
    const cart = await this.cartsRepo.findActiveCartByUserId(userId)
    if (!cart) throw new AppError({ code: "not_found", message: "Carrito activo no encontrado" })

    // Validar reglas si la cantidad no es 0
    if (quantity > 0) {
      const validation = await this.pricingService.validateQuantity(productId, quantity, variantId)
      if (!validation.valid)
        throw new AppError({ code: "custom", message: validation.error, statusCode: 400 })

      await this.cartsRepo.upsertCartItem(cart.id, productId, variantId, quantity)
    } else {
      await this.cartsRepo.deleteCartItem(cart.id, productId, variantId)
    }

    return this.getActiveCartHydrated(userId, userTier)
  }

  async clearCart(userId: string) {
    const cart = await this.cartsRepo.findActiveCartByUserId(userId)
    if (!cart) return { message: "El carrito ya está vacío" }

    await this.cartsRepo.clearCart(cart.id)
    return { message: "Carrito vaciado exitosamente" }
  }
}

export const cartsService = new CartsService(cartsRepository, productsPricingService)
