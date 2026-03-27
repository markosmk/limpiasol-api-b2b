import type { PurchaseRule } from "@/db/schema/products.types"
import type { PriceValidationResult } from "../pricing/pricing.types"

export type PricingTier = "retail" | "wholesale" | "reseller" | "vip"

export const ROLE_TO_PRICING_TIER: Record<string, PricingTier> = {
  user: "retail",
  reseller: "reseller",
  admin: "reseller"
}

export function getTierFromRole(role: string): PricingTier {
  return ROLE_TO_PRICING_TIER[role] || "retail"
}

/**
 * Calcula precio con descuento por volumen
 */
export function applyVolumeDiscount(
  basePrice: number,
  quantity: number,
  discounts: Array<{ quantity: number; discountPercent: number }> = []
): { price: number; appliedDiscount?: { quantity: number; discountPercent: number } } {
  if (!discounts.length) return { price: basePrice }

  const applicable = discounts
    .filter((d) => quantity >= d.quantity)
    .sort((a, b) => b.quantity - a.quantity)[0]

  if (!applicable) return { price: basePrice }

  const discounted = basePrice * (1 - applicable.discountPercent / 100)
  return {
    price: Math.round(discounted * 100) / 100,
    appliedDiscount: applicable
  }
}

/**
 * Valida reglas de compra B2B
 */

export function validatePurchaseRules(
  quantity: number,
  rules: PurchaseRule | null
): PriceValidationResult {
  if (!rules) return { valid: true }

  if (quantity < rules.minQuantity) {
    return {
      valid: false,
      error: `Mínimo ${rules.minQuantity} ${rules.unitName || "unidades"}`,
      suggestion: `Agregá al menos ${rules.minQuantity - quantity} más`,
      code: "quantity_validation_failed"
    }
  }

  if (rules.maxQuantity && quantity > rules.maxQuantity) {
    return {
      valid: false,
      error: `Máximo ${rules.maxQuantity} ${rules.unitName || "unidades"}`,
      suggestion: `Reducí la cantidad en ${quantity - rules.maxQuantity}`,
      code: "quantity_validation_failed"
    }
  }

  if (rules.stepQuantity > 1 && quantity % rules.stepQuantity !== 0) {
    const nextValid = Math.ceil(quantity / rules.stepQuantity) * rules.stepQuantity
    return {
      valid: false,
      error: `Debe ser múltiplo de ${rules.stepQuantity}`,
      suggestion: `Probá con ${nextValid} ${rules.unitName || "unidades"}`,
      code: "quantity_validation_failed"
    }
  }

  return { valid: true }
}

export function formatPriceResponse(basePrice: number, finalPrice: number) {
  const hasDiscount = finalPrice < basePrice

  return {
    unitPrice: finalPrice,
    originalPrice: basePrice,
    currency: "ARS",
    hasDiscount,
    discountPercent: hasDiscount ? Math.round(((basePrice - finalPrice) / basePrice) * 100) : 0
  }
}
