import { beforeEach, describe, expect, it, vi } from "vitest"
import { moduleManager } from "../module-manager"
import { TaxesModule } from "./taxes.module"
import type { ModuleConfig } from "../module.types"
import type { TaxesModuleConfig } from "./taxes.module.types"

vi.mock("module-manager", () => ({
  moduleManager: { getConfig: vi.fn() }
}))

describe("TaxesModule (extends BaseModule)", () => {
  let taxesModule: TaxesModule

  beforeEach(() => {
    vi.clearAllMocks()
    taxesModule = new TaxesModule()
  })

  describe("calculateTaxes", () => {
    it("returns 0 when module is disabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: false,
        config: { defaultRate: 0.21 }
      })

      const result = await taxesModule.calculateTaxes({
        province: "CABA",
        subtotal: 10000
      })

      expect(result.amount).toBe(0)
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1)
    })

    it("caches config after first call", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: { defaultRate: 0.21 }
      })

      await taxesModule.calculateTaxes({ province: "CABA", subtotal: 10000 })
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1)

      await taxesModule.calculateTaxes({ province: "CABA", subtotal: 20000 })
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1) // ¡Sin query extra!
    })

    it("can refresh config manually", async () => {
      vi.mocked(moduleManager.getConfig)
        .mockResolvedValueOnce({ enabled: true, config: { defaultRate: 0.21 } })
        .mockResolvedValueOnce({ enabled: true, config: { defaultRate: 0.1 } })

      await taxesModule.calculateTaxes({ province: "CABA", subtotal: 10000 })
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1)

      await taxesModule.refreshConfig()
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(2)
    })

    it("applies provincial rate when rule matches", async () => {
      const mockConfig: ModuleConfig<TaxesModuleConfig> = {
        enabled: true,
        config: {
          defaultRate: 0.21,
          provincialRates: [{ province: "CABA", rate: 0.03, concept: "Ingresos Brutos" }]
        }
      }

      vi.mocked(moduleManager.getConfig).mockResolvedValue(mockConfig)

      const result = await taxesModule.calculateTaxes({
        province: "CABA",
        subtotal: 10000
      })

      expect(result.amount).toBe(300) // 3% de 10000
      expect(result.breakdown[0].concept).toBe("Ingresos Brutos")
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1)
    })

    it("respects taxesIncludedInPrice flag", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultRate: 0.21,
          taxesIncludedInPrice: true
        }
      })

      const result = await taxesModule.calculateTaxes({
        province: "CABA",
        subtotal: 10000
      })

      expect(result.amount).toBe(0)
      expect(result.taxesIncluded).toBe(true)
    })
  })

  describe("getTaxRateForProvince", () => {
    it("returns enabled: false when module is disabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: false,
        config: {}
      })

      const result = await taxesModule.getTaxRateForProvince("CABA")

      expect(result.enabled).toBe(false)
      expect(result.rate).toBe(0)
    })

    it("returns provincial rate when available", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          defaultRate: 0.21,
          provincialRates: [{ province: "CABA", rate: 0.03, concept: "IB" }]
        }
      })

      const result = await taxesModule.getTaxRateForProvince("CABA")

      expect(result.enabled).toBe(true)
      expect(result.rate).toBe(0.03)
      expect(result.concept).toBe("IB")
    })
  })

  describe("isEnabled (inherited from BaseModule)", () => {
    it("returns false before initialization", () => {
      expect(taxesModule.isEnabled()).toBe(false)
    })

    it("returns true after initialization if enabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {}
      })

      await taxesModule.calculateTaxes({ province: "CABA", subtotal: 10000 })
      expect(taxesModule.isEnabled()).toBe(true)
    })
  })
})
