import { applyVolumeDiscount, validatePurchaseRules } from "../lib/pricing.utils"
import type { PriceTier } from "@/db/pg/products"
import type { VolumeDiscount } from "@/db/pg/products.types"
import type {
  PriceValidationResult,
  PricingContext,
  PricingResult,
  UserTier
} from "./pricing.types"

import {
  type ProductsPricingRepository,
  productsPricingRepository
} from "@/domains/products/pricing/pricing.repository"
import { type ProductsRepository, productsRepository } from "@/domains/products/products.repository"
import { AppError } from "@/utils/app-error"

export class ProductsPricingService {
  constructor(
    private readonly repository: ProductsPricingRepository,
    private readonly productsRepo: ProductsRepository
  ) {}

  /**
   * Calcula el precio final para un usuario según su tier, cantidad y variante
   * use:
   * - in adjusting pricing of a product specific..
   * - in show price of a product in product detail
   */
  async calculatePrice(ctx: PricingContext): Promise<PricingResult> {
    // TODO: better performance one query
    // const tiers = await productsPricingRepository.findPriceTiersForProduct(productId, variantId)
    // const tier = tiers.find(t => t.tierType === userTier) || tiers.find(t => t.tierType === "retail")

    const tier = await this.repository.findPriceTier(ctx.productId, ctx.variantId, ctx.userTier)
    if (!tier) {
      const fallback = await this.repository.findFallbackRetailPrice(ctx.productId, ctx.variantId)
      if (!fallback) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "No hay precio disponible para este producto"
        })
      }
      return this._buildPricingResult(fallback, ctx.quantity, "retail")
    }
    return this._buildPricingResult(tier, ctx.quantity, ctx.userTier)
  }

  /**
   * Calcula los precios para múltiples variantes en una sola pasada de BD.
   * Retorna un Record/Diccionario donde la key es el variantId.
   */
  async calculatePricesBulk(
    items: Array<{ productId: string; variantId: string | null; quantity: number }>,
    userTier: UserTier
  ): Promise<Record<string, PricingResult>> {
    if (items.length === 0) return {}

    const productIds = Array.from(new Set(items.map((i) => i.productId)))
    
    // 1. Un solo viaje a la BD para traer todos los precios (tier actual y retail) de los productos
    const allTiers = await this.repository.findTiersForProductsBulk(productIds, userTier)

    const bulkResults: Record<string, PricingResult> = {}

    // 2. Procesamos en memoria
    for (const item of items) {
      let tier: PriceTier | undefined
      let appliedTier = userTier

      // A. Buscar tier específico de la variante (si aplica)
      if (item.variantId) {
        tier = allTiers.find((t) => t.variantId === item.variantId && t.tierType === userTier)
        if (!tier) {
          tier = allTiers.find((t) => t.variantId === item.variantId && t.tierType === "retail")
          if (tier) appliedTier = "retail"
        }
      }

      // B. Fallback al tier base del producto
      if (!tier) {
        tier = allTiers.find((t) => t.productId === item.productId && t.variantId === null && t.tierType === userTier)
        appliedTier = userTier
      }

      // C. Fallback final al retail base del producto
      if (!tier) {
        tier = allTiers.find((t) => t.productId === item.productId && t.variantId === null && t.tierType === "retail")
        if (tier) appliedTier = "retail"
      }

      if (!tier) {
        throw new AppError({
          code: "price_not_found",
          message: `No hay precio disponible para la variante ${item.variantId || 'base'}`,
          statusCode: 404
        })
      }

      // 3. Reutilizamos lógica de descuentos por volumen
      // Usamos el variantId o productId como key dependiendo de qué estemos procesando
      const key = item.variantId || item.productId
      bulkResults[key] = this._buildPricingResult(tier, item.quantity, appliedTier)
    }

    return bulkResults
  }

  /**
   * Valida si una cantidad cumple las reglas de compra del producto
   * (purchaseRules JSON)
   */
  async validateQuantity(quantity: number, productId: string, variantId: string | null): Promise<PriceValidationResult> {
    const activeRules = await this.productsRepo.getResolvedPurchaseRules(productId, variantId)
    if (!activeRules) {
      return {
        valid: false,
        code: "not_found",
        error: "Variante no encontrada",
        suggestion: "Verificá el ID o contactá a soporte"
      }
    }

    // FUTURO: Si las reglas se complejizan, migrar a tabla normalizada:
    // - Crear tabla `product_rules` con columns: productId, ruleType, config (JSON), priority
    // - Reemplazar esta llamada por: await productsRulesRepository.findByProduct(productId)
    // - La función validatePurchaseRules sigue siendo la misma (solo cambia la fuente de datos)
    return validatePurchaseRules(quantity, activeRules)
  }

  /**
   * Obtiene todas las opciones de precio para mostrar en UI
   * (ej: "Precio lista: $100 | Mayorista: $75 | Revendedor: $60")
   */
  async getPriceOptions(productId: string, variantId?: string | null, userTier?: string) {
    const tiers = await this.repository.getAllPriceOptions(productId, variantId, userTier)

    return tiers.map((tier) => ({
      tierType: tier.tierType,
      // Precio base (el que paga el usuario)
      basePrice: Number(tier.price),
      // Precio tachado
      compareAtPrice: tier.compareAtPrice ? Number(tier.compareAtPrice) : undefined,
      // Descuento de volumen aplica desde X unidades
      // minQuantity: tier.minQuantity,
      // Descuentos por volumen
      volumeDiscounts: tier.volumeDiscounts as VolumeDiscount[] | undefined
    }))
  }

  /**
   * Método privado: construye el resultado de pricing
   */
  _buildPricingResult(tier: PriceTier, quantity: number, appliedTier: string): PricingResult {
    const basePrice = Number(tier.price)
    const volumeDiscounts = tier.volumeDiscounts as VolumeDiscount[] | undefined

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
      // minQuantity: tier.minQuantity || 1,
      hasDiscount: finalPrice < basePrice,
      discountPercent:
        finalPrice < basePrice ? Math.round(((basePrice - finalPrice) / basePrice) * 100) : 0
    }
  }
}

export const productsPricingService = new ProductsPricingService(
  productsPricingRepository,
  productsRepository
)
