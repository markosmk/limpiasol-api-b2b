import { applyVolumeDiscount, validatePurchaseRules } from "./lib/pricing.utils"
import { productsPricingRepository } from "./products.pricing.repository"
import { productsRepository } from "./products.repository"
import type { PriceTier } from "@/db/schema"
import type { PurchaseRule } from "@/db/schema/products.types"
import type {
  PriceValidationResult,
  PricingContext,
  PricingResult,
  UserTier
} from "./products.pricing.types"

import { AppError } from "@/utils/app-error"

export const productsPricingService = {
  /**
   * Calcula el precio final para un usuario según su tier, cantidad y variante
   */
  async calculatePrice(ctx: PricingContext): Promise<PricingResult> {
    // TODO: better
    // const tiers = await productsPricingRepository.findPriceTiersForProduct(productId, variantId)
    // const tier = tiers.find(t => t.tierType === userTier) || tiers.find(t => t.tierType === "retail")

    const tier = await productsPricingRepository.findPriceTier(ctx)
    if (!tier) {
      const fallback = await productsPricingRepository.findFallbackRetailPrice(
        ctx.productId,
        ctx.variantId
      )
      if (!fallback) {
        throw new AppError({
          code: "price_not_found",
          message: `No hay precio disponible para este producto`,
          statusCode: 404
        })
      }
      return this._buildPricingResult(fallback, ctx.quantity, "retail")
    }
    return this._buildPricingResult(tier, ctx.quantity, ctx.userTier)
  },

  /**
   * Valida si una cantidad cumple las reglas de compra del producto
   * (purchaseRules JSON)
   */
  async validateQuantity(
    productId: string,
    quantity: number,
    _variantId?: string | null
  ): Promise<PriceValidationResult> {
    // FUTURO: Si las variantes necesitan reglas propias:
    // - Agregar campo `purchaseRules` en `productVariants`
    // - Priorizar: variante.rules > producto.rules > defaults
    // - Ej: Variante "Mayorista" podría tener minQuantity: 50, mientras el producto base tiene 10

    // 1. Buscar producto con sus reglas (solo activos para rutas públicas)
    const product = await productsRepository.findProductById(productId)
    if (!product) {
      return {
        valid: false,
        code: "not_found",
        error: "Producto no disponible",
        suggestion: "Verificá el ID o contactá a soporte"
      }
    }
    // FUTURO: Si las reglas se complejizan, migrar a tabla normalizada:
    // - Crear tabla `product_rules` con columns: productId, ruleType, config (JSON), priority
    // - Reemplazar esta llamada por: await productsRulesRepository.findByProduct(productId)
    // - La función validatePurchaseRules sigue siendo la misma (solo cambia la fuente de datos)

    // 2. Parsear reglas (con fallback a valores por defecto)
    const rules = product.purchaseRules as PurchaseRule

    const defaultRules = {
      minQuantity: 1,
      maxQuantity: undefined as number | undefined,
      stepQuantity: 1,
      unitName: "unidades"
    }

    const purchaseRules = rules || defaultRules

    return validatePurchaseRules(quantity, purchaseRules)
  },

  /**
   * Obtiene todas las opciones de precio para mostrar en UI
   * (ej: "Precio lista: $100 | Mayorista: $75 | Revendedor: $60")
   */
  async getPriceOptions(productId: string, variantId?: string | null) {
    const tiers = await productsPricingRepository.getAllPriceOptions(productId, variantId)

    return tiers.map((tier) => ({
      tierType: tier.tierType,
      basePrice: Number(tier.price),
      compareAtPrice: tier.compareAtPrice ? Number(tier.compareAtPrice) : undefined,
      minQuantity: tier.minQuantity,
      volumeDiscounts: tier.volumeDiscounts as
        | Array<{
            quantity: number
            discountPercent: number
          }>
        | undefined
    }))
  },

  /**
   * Obtiene el precio base para mostrar en catálogo/detalle
   * Usa minQuantity o 1, según lo que tenga sentido para el producto
   */
  async getDisplayPrice(productId: string, variantId?: string | null, userTier?: string) {
    // TODO: repository only get basic info and purchaseRules
    const product = await productsRepository.findProductById(productId)
    const rules = product?.purchaseRules as PurchaseRule
    const quantity = rules?.minQuantity || 1

    return await this.calculatePrice({
      productId,
      variantId,
      userTier: (userTier as UserTier) || "retail",
      quantity
    })
  },

  /**
   * Método privado: construye el resultado de pricing
   */
  _buildPricingResult(tier: PriceTier, quantity: number, appliedTier: string): PricingResult {
    const basePrice = Number(tier.price)
    const volumeDiscounts = tier.volumeDiscounts as
      | Array<{ quantity: number; discountPercent: number }>
      | undefined

    const { price: finalPrice, appliedDiscount } = applyVolumeDiscount(
      basePrice,
      quantity,
      volumeDiscounts || []
    )

    const originalPrice = tier.compareAtPrice ? Number(tier.compareAtPrice) : basePrice

    return {
      unitPrice: finalPrice,
      currency: "ARS",
      originalPrice,
      appliedTier: appliedTier as UserTier,
      volumeDiscount: appliedDiscount,
      finalSubtotal: Math.round(finalPrice * quantity * 100) / 100,
      minQuantity: tier.minQuantity || 1,
      hasDiscount: finalPrice < basePrice,
      discountPercent:
        finalPrice < basePrice ? Math.round(((basePrice - finalPrice) / basePrice) * 100) : 0
    }
  }
}
