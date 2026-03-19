import { beforeEach, describe, expect, it, vi } from "vitest"
import { moduleManager } from "../module-manager"
import { AnalyticsModule } from "./analytics.module"

vi.mock("./moduleManager", () => ({
  moduleManager: { getConfig: vi.fn() }
}))

describe("AnalyticsModule", () => {
  let analyticsModule: AnalyticsModule

  beforeEach(() => {
    vi.clearAllMocks()
    analyticsModule = new AnalyticsModule()
  })

  describe("trackEvent", () => {
    it("returns error when module is disabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: false,
        config: { provider: "google" }
      })

      const result = await analyticsModule.trackEvent({
        eventName: "purchase"
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("not enabled")
    })

    it("tracks event successfully (mocked)", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: { provider: "google" }
      })

      const result = await analyticsModule.trackEvent({
        eventName: "purchase",
        category: "ecommerce",
        value: 15000
      })

      expect(result.success).toBe(true)
      expect(result.provider).toBe("google")
    })
  })

  describe("trackPageView", () => {
    it("respects Do Not Track setting", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          provider: "google",
          respectDoNotTrack: true
        }
      })

      // Simular DNT en window
      const originalNavigator = global.navigator
      Object.defineProperty(global, "navigator", {
        value: { doNotTrack: "1" },
        writable: true
      })

      const result = await analyticsModule.trackPageView("/products")

      expect(result.success).toBe(true)
      expect(result.error).toContain("Do Not Track")

      // Restaurar
      global.navigator = originalNavigator
    })

    it("excludes logged-in users when configured", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          provider: "google",
          excludeLoggedInUsers: true
        }
      })

      const result = await analyticsModule.trackPageView("/dashboard", {
        userId: "user_123"
      })

      expect(result.success).toBe(true)
      expect(result.error).toContain("excluded")
    })
  })

  describe("getTrackingScript", () => {
    it("returns null when module is disabled", () => {
      // No mockear, usar estado inicial (not initialized)
      const script = analyticsModule.getTrackingScript()
      expect(script).toBeNull()
    })

    it("generates Google Analytics script", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          provider: "google",
          trackingId: "G-ABC123",
          googleConfig: {
            measurementId: "G-ABC123",
            anonymizeIp: true
          }
        }
      })

      // Forzar inicialización
      await analyticsModule.trackPageView("/")

      const script = analyticsModule.getTrackingScript()

      expect(script).toContain("G-ABC123")
      expect(script).toContain("googletagmanager.com/gtag")
    })

    it("generates Plausible script", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: {
          provider: "plausible",
          domain: "mitienda.com",
          plausibleConfig: {
            domain: "mitienda.com"
          }
        }
      })

      await analyticsModule.trackPageView("/")

      const script = analyticsModule.getTrackingScript()

      expect(script).toContain("plausible.io/js/script.js")
      expect(script).toContain('data-domain="mitienda.com"')
    })
  })
})
