import { describe, expect, it } from "vitest"
import {
  applyVolumeDiscount,
  formatPriceResponse,
  getTierFromRole,
  ROLE_TO_PRICING_TIER,
  validatePurchaseRules
} from "./pricing.utils"

// ─────────────────────────────────────────
// applyVolumeDiscount
// ─────────────────────────────────────────
describe("applyVolumeDiscount", () => {
  it("returns base price when no discounts are provided", () => {
    const result = applyVolumeDiscount(100, 5, [])
    expect(result).toEqual({ price: 100 })
  })

  it("returns base price when quantity does not reach any discount tier", () => {
    const discounts = [
      { quantity: 10, discountPercent: 10 },
      { quantity: 50, discountPercent: 20 }
    ]
    const result = applyVolumeDiscount(100, 5, discounts)
    expect(result).toEqual({ price: 100 })
  })

  it("applies the highest applicable discount tier", () => {
    const discounts = [
      { quantity: 10, discountPercent: 10 },
      { quantity: 50, discountPercent: 20 },
      { quantity: 100, discountPercent: 30 }
    ]
    const result = applyVolumeDiscount(100, 75, discounts)
    // 75 >= 50, so 20% discount applies
    expect(result).toEqual({
      price: 80, // 100 * 0.8
      appliedDiscount: { quantity: 50, discountPercent: 20 }
    })
  })

  it("rounds price to 2 decimal places", () => {
    const discounts = [{ quantity: 5, discountPercent: 33 }]
    const result = applyVolumeDiscount(99.99, 10, discounts)
    // 99.99 * 0.67 = 66.9933 → rounded to 66.99
    expect(result.price).toBe(66.99)
  })

  it("handles edge case: exact quantity match", () => {
    const discounts = [{ quantity: 10, discountPercent: 15 }]
    const result = applyVolumeDiscount(200, 10, discounts)
    expect(result).toEqual({
      price: 170, // 200 * 0.85
      appliedDiscount: { quantity: 10, discountPercent: 15 }
    })
  })
})

// ─────────────────────────────────────────
// validatePurchaseRules
// ─────────────────────────────────────────
describe("validatePurchaseRules", () => {
  const defaultRules = {
    minQuantity: 5,
    maxQuantity: 100,
    stepQuantity: 5,
    unitName: "unidades"
  }

  it("returns valid:true when quantity meets all rules", () => {
    const result = validatePurchaseRules(20, defaultRules)
    expect(result).toEqual({ valid: true })
  })

  it("rejects quantity below minQuantity with helpful message", () => {
    const result = validatePurchaseRules(3, defaultRules)
    expect(result).toEqual({
      valid: false,
      error: "Mínimo 5 unidades",
      suggestion: "Agregá al menos 2 más",
      code: "quantity_validation_failed"
    })
  })

  it("rejects quantity above maxQuantity with helpful message", () => {
    const result = validatePurchaseRules(150, defaultRules)
    expect(result).toEqual({
      valid: false,
      error: "Máximo 100 unidades",
      suggestion: "Reducí la cantidad en 50",
      code: "quantity_validation_failed"
    })
  })

  it("rejects quantity that does not match stepQuantity", () => {
    const result = validatePurchaseRules(22, defaultRules)
    expect(result).toEqual({
      valid: false,
      error: "Debe ser múltiplo de 5",
      suggestion: "Probá con 25 unidades",
      code: "quantity_validation_failed"
    })
  })

  it("uses default unitName when not provided", () => {
    const rules = { minQuantity: 10, maxQuantity: undefined, stepQuantity: 1 }
    const result = validatePurchaseRules(5, rules)
    expect(result.error).toContain("unidades")
  })

  it("uses custom unitName when provided", () => {
    const rules = {
      minQuantity: 2,
      maxQuantity: undefined,
      stepQuantity: 1,
      unitName: "cajas"
    }
    const result = validatePurchaseRules(1, rules)
    expect(result.error).toBe("Mínimo 2 cajas")
    expect(result.suggestion).toBe("Agregá al menos 1 más")
  })

  it("allows unlimited maxQuantity when undefined", () => {
    const rules = { minQuantity: 1, maxQuantity: undefined, stepQuantity: 1 }
    const result = validatePurchaseRules(9999, rules)
    expect(result.valid).toBe(true)
  })
})

// ─────────────────────────────────────────
// formatPriceResponse
// ─────────────────────────────────────────
describe("formatPriceResponse", () => {
  it("formats price with no discount", () => {
    const result = formatPriceResponse(100, 100)
    expect(result).toEqual({
      unitPrice: 100,
      originalPrice: 100,
      currency: "ARS",
      hasDiscount: false,
      discountPercent: 0
    })
  })

  it("formats price with discount and calculates percent", () => {
    const result = formatPriceResponse(100, 80)
    expect(result).toEqual({
      unitPrice: 80,
      originalPrice: 100,
      currency: "ARS",
      hasDiscount: true,
      discountPercent: 20
    })
  })

  it("handles decimal prices correctly", () => {
    const result = formatPriceResponse(99.99, 74.99)
    expect(result).toEqual({
      unitPrice: 74.99,
      originalPrice: 99.99,
      currency: "ARS",
      hasDiscount: true,
      discountPercent: 25 // (99.99-74.99)/99.99 ≈ 25%
    })
  })

  it("defaults currency to ARS", () => {
    const result = formatPriceResponse(50, 40)
    expect(result.currency).toBe("ARS")
  })
})

// ─────────────────────────────────────────
// getTierFromRole / ROLE_TO_PRICING_TIER
// ─────────────────────────────────────────
describe("Pricing tier mapping", () => {
  it("maps known roles to pricing tiers", () => {
    expect(getTierFromRole("user")).toBe("retail")
    expect(getTierFromRole("reseller")).toBe("reseller")
    expect(getTierFromRole("admin")).toBe("reseller")
  })

  it("defaults to retail for unknown roles", () => {
    expect(getTierFromRole("unknown_role")).toBe("retail")
    expect(getTierFromRole("")).toBe("retail")
  })

  it("ROLE_TO_PRICING_TIER contains expected mappings", () => {
    expect(ROLE_TO_PRICING_TIER).toMatchObject({
      user: "retail",
      reseller: "reseller",
      admin: "reseller"
    })
  })
})
