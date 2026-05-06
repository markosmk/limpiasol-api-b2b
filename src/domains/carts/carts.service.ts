import {
  type ProductsPricingService,
  productsPricingService
} from "../products/pricing/pricing.service"
import { productsRepository } from "../products/products.repository"
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
    const cart = await this.cartsRepo.findActiveCartByUserId(userId)
    if (!cart) {
      return await this.cartsRepo.createCart(userId)
    }
    return cart
  }

  async getActiveCartHydrated(userId: string, userTier: string) {
    const cart = await this.getOrCreateActiveCart(userId)
    if (!cart?.items || cart.items.length === 0) {
      return { ...cart, subtotal: 0, items: [] }
    }

    // 1. Pasamos el array limpio al servicio de pricing (sin Promise.all)
    const itemsToCalculate = cart.items.map((i) => ({
      productId: i.variant.productId,
      variantId: i.variantId,
      quantity: i.quantity
    }))

    const calculatedPricesMap = await this.pricingService.calculatePricesBulk(
      itemsToCalculate,
      userTier as UserTier
    )

    let subtotal = 0

    // 2. Mapeamos los resultados devueltos al carrito
    const hydratedItems = cart.items.map((item) => {
      const pricing = calculatedPricesMap[item.variantId]
      subtotal += pricing.finalSubtotal

      return {
        ...item,
        pricing
      }
    })

    // 4. Retornamos el carrito completo con el subtotal calculado
    return {
      ...cart,
      items: hydratedItems,
      subtotal: Math.round(subtotal * 100) / 100 // Prevenir errores de punto flotante en JS
    }
  }

  async addItem(userId: string, data: AddToCartInput, userTier: UserTier) {
    const cart = await this.getOrCreateActiveCart(userId)
    if (!cart) throw new AppError({ code: "NOT_FOUND", message: "Carrito activo no encontrado." })

    // 1. Buscamos si ya existe para saber la cantidad actual
    const existingItem = await this.cartsRepo.findCartItem(cart.id, data.variantId)

    // 2. Calculamos la nueva cantidad TOTAL a validar
    const newTotalQuantity = (existingItem?.quantity || 0) + data.quantity

    // 1. Validar reglas de compra ANTES de hacer nada
    const variantInfo = await productsRepository.findVariantWithProduct(data.variantId)
    if (!variantInfo) throw new AppError({ code: "NOT_FOUND", message: "Variante no encontrada." })

    const validation = await this.pricingService.validateQuantity(
      newTotalQuantity,
      variantInfo.product.id,
      data.variantId
    )

    if (!validation.valid) {
      throw new AppError({
        code: "VALIDATION_RULES",
        message: validation.error
      })
    }

    if (existingItem) {
      await this.cartsRepo.updateCartItemQuantity(existingItem.id, newTotalQuantity)
    } else {
      await this.cartsRepo.insertCartItem(cart.id, data.variantId, data.quantity)
    }

    // 3. Retornar carrito actualizado
    return this.getActiveCartHydrated(userId, userTier)
  }

  async updateItemQuantity(
    userId: string,
    variantId: string,
    quantity: number,
    userTier: UserTier
  ) {
    const cart = await this.cartsRepo.findActiveCartByUserId(userId)
    if (!cart) throw new AppError({ code: "NOT_FOUND", message: "Carrito activo no encontrado." })

    // Validar reglas si la cantidad no es 0
    if (quantity > 0) {
      // Aquí validamos directamente la cantidad entrante porque es una sobrescritura absoluta
      const variantInfo = await productsRepository.findVariantWithProduct(variantId)
      if (!variantInfo)
        throw new AppError({ code: "NOT_FOUND", message: "Variante no encontrada." })

      const validation = await this.pricingService.validateQuantity(
        quantity,
        variantInfo.product.id,
        variantId
      )
      if (!validation.valid) {
        throw new AppError({ code: "VALIDATION_RULES", message: validation.error })
      }
      const existingItem = await this.cartsRepo.findCartItem(cart.id, variantId)
      if (existingItem) {
        await this.cartsRepo.updateCartItemQuantity(existingItem.id, quantity)
      } else {
        await this.cartsRepo.insertCartItem(cart.id, variantId, quantity)
      }
    } else {
      await this.cartsRepo.deleteCartItem(cart.id, variantId)
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
