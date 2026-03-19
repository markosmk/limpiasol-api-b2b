import { beforeEach, describe, expect, it, vi } from "vitest"
import { moduleManager } from "../module-manager"
import { DiscountsModule } from "./discounts.module"
import type { ModuleConfig } from "../module.types"
import type { DiscountsModuleConfig } from "./discounts.module.types"

vi.mock("../module-manager", () => ({
  moduleManager: { getConfig: vi.fn() }
}))

describe("DiscountsModule", () => {
  let discountsModule: DiscountsModule

  beforeEach(() => {
    vi.clearAllMocks()
    discountsModule = new DiscountsModule()
  })

  describe("calculateDiscount", () => {
    it("returns no discount when module is disabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: false,
        config: { defaultDiscount: 0.1, defaultType: "percentage" }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000
      })

      expect(result.hasDiscount).toBe(false)
      expect(result.amount).toBe(0)
    })

    it("applies percentage discount by default", async () => {
      const config: ModuleConfig<DiscountsModuleConfig> = {
        enabled: true,
        config: {
          defaultDiscount: 0.15, // 15%
          defaultType: "percentage"
        }
      }

      vi.mocked(moduleManager.getConfig).mockResolvedValue(config)

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000
      })

      expect(result.hasDiscount).toBe(true)
      expect(result.amount).toBe(1500) // 15% de 10000
      expect(result.percentage).toBe(0.15)
    })

    it("applies fixed discount", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 500, // $500 OFF
          defaultType: "fixed"
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000
      })

      expect(result.amount).toBe(500)
    })

    it("respects minPurchaseAmount", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0.1,
          defaultType: "percentage",
          minPurchaseAmount: 5000
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 3000 // Menor al mínimo
      })

      expect(result.hasDiscount).toBe(false)
      expect(result.message).toContain("Monto mínimo")
    })

    it("validates coupon code", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0,
          defaultType: "percentage",
          validCouponCodes: [
            {
              code: "HOLAMUNDO",
              type: "percentage",
              value: 0.2, // 20% OFF
              validUntil: "2025-12-31",
              minPurchase: 5000
            }
          ]
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000,
        couponCode: "HOLAMUNDO"
      })

      expect(result.hasDiscount).toBe(true)
      expect(result.amount).toBe(2000) // 20% de 10000
      expect(result.couponCode).toBe("HOLAMUNDO")
    })

    it("rejects expired coupon", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0,
          defaultType: "percentage",
          validCouponCodes: [
            {
              code: "EXPIRED",
              type: "percentage",
              value: 0.2,
              validUntil: "2020-12-31" // Expirado
            }
          ]
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000,
        couponCode: "EXPIRED"
      })

      expect(result.hasDiscount).toBe(false)
      expect(result.message).toContain("expirado")
    })

    it("applies category-specific discount", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0.05, // 5% default
          defaultType: "percentage",
          categoryDiscounts: [
            {
              categoryId: "cat_electronics",
              type: "percentage",
              value: 0.15, // 15% en electrónica
              label: "15% OFF en Electrónica"
            }
          ]
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000,
        categoryIds: ["cat_electronics"]
      })

      expect(result.amount).toBe(1500) // 15% en lugar de 5%
    })

    it("respects maxDiscountAmount", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0.5, // 50%
          defaultType: "percentage",
          maxDiscountAmount: 0.3 // Máximo 30% del subtotal
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000
      })

      expect(result.amount).toBe(3000) // 30% en lugar de 50%
    })

    it("respects absoluteMaxDiscount", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 5000, // $5000 OFF
          defaultType: "fixed",
          absoluteMaxDiscount: 2000 // Máximo $2000
        }
      })

      const result = await discountsModule.calculateDiscount({
        subtotal: 10000
      })

      expect(result.amount).toBe(2000) // Limitado a $2000
    })
  })

  describe("validateCouponCode", () => {
    it("returns valid for active coupon", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0,
          defaultType: "percentage",
          validCouponCodes: [
            {
              code: "VALID123",
              type: "percentage",
              value: 0.1,
              validUntil: "2025-12-31"
            }
          ]
        }
      })

      const result = await discountsModule.validateCouponCode("VALID123")

      expect(result.valid).toBe(true)
      expect(result.discount).toEqual({ type: "percentage", value: 0.1 })
    })

    it("returns invalid for non-existent coupon", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0,
          defaultType: "percentage",
          validCouponCodes: []
        }
      })

      const result = await discountsModule.validateCouponCode("FAKE")

      expect(result.valid).toBe(false)
      expect(result.message).toContain("inválido")
    })
  })

  describe("getActiveCoupons", () => {
    it("returns list of active coupons", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0,
          defaultType: "percentage",
          validCouponCodes: [
            {
              code: "SUMMER2024",
              type: "percentage",
              value: 0.2,
              description: "20% OFF en verano",
              validUntil: "2025-03-31",
              minPurchase: 5000
            }
          ]
        }
      })

      const coupons = await discountsModule.getActiveCoupons()

      expect(coupons).toHaveLength(1)
      expect(coupons[0].code).toBe("SUMMER2024")
      expect(coupons[0].discount).toBe("20% OFF")
    })

    it("excludes expired coupons", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultDiscount: 0,
          defaultType: "percentage",
          validCouponCodes: [
            {
              code: "EXPIRED",
              type: "percentage",
              value: 0.2,
              validUntil: "2020-01-01"
            }
          ]
        }
      })

      const coupons = await discountsModule.getActiveCoupons()

      expect(coupons).toHaveLength(0)
    })
  })
})
