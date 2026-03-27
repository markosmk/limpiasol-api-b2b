/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import { BaseModule } from "../base.module"
import type { AnalyticsEvent, AnalyticsModuleConfig, TrackResult } from "./analytics.module.types"

import { decryptFromBase64 } from "@/utils/crypto"

/**
 * Módulo de Analytics
 *
 * Soporta:
 * - Google Analytics 4 (GA4)
 * - Plausible Analytics
 * - Umami Analytics
 * - Custom providers
 *
 * Características:
 * - Respeto a privacidad (Do Not Track, excluir logged-in)
 * - Eventos personalizados
 * - Page views automáticos (opcional)
 */
export class AnalyticsModule extends BaseModule<AnalyticsModuleConfig> {
  constructor() {
    super("analytics")
  }

  /**
   * Trackea un evento personalizado
   *
   * @example
   * await analyticsModule.trackEvent({
   *   eventName: "purchase",
   *   category: "ecommerce",
   *   label: "order_completed",
   *   value: 15000,
   *   properties: { orderId: "ord_123", items: 3 }
   * })
   */
  async trackEvent(event: AnalyticsEvent): Promise<TrackResult> {
    await this.ensureInitialized()

    if (!this.enabled || !this.config) {
      return { success: false, error: "Analytics module not enabled" }
    }

    try {
      const { provider } = this.config

      switch (provider) {
        case "google":
          return await this._trackGoogleEvent(event)
        case "plausible":
          return await this._trackPlausibleEvent(event)
        case "umami":
          return await this._trackUmamiEvent(event)
        default:
          console.log(`[Analytics] Event (${provider}):`, event)
          return { success: true, provider }
      }
    } catch (error) {
      console.error("[Analytics] Track event failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Trackea una página vista (pageview)
   *
   * @example
   * await analyticsModule.trackPageView("/products", {
   *   title: "Productos - Mi Tienda",
   *   referrer: document.referrer
   * })
   */
  async trackPageView(
    path: string,
    options?: {
      title?: string
      referrer?: string
      userId?: string
    }
  ): Promise<TrackResult> {
    await this.ensureInitialized()

    if (!this.enabled || !this.config) {
      return { success: false, error: "Analytics module not enabled" }
    }

    // Respetar Do Not Track
    if (
      this.config.respectDoNotTrack &&
      typeof window !== "undefined" &&
      // TODO: navigator.doNotTrack puede no estar tipado
      window.navigator.doNotTrack === "1"
    ) {
      return { success: true, error: "Do Not Track enabled" }
    }

    // Excluir usuarios logueados si está configurado
    if (this.config.excludeLoggedInUsers && options?.userId) {
      return { success: true, error: "User logged in, excluded" }
    }

    try {
      const { provider } = this.config

      switch (provider) {
        case "google":
          return await this._trackGooglePageView(path, options)
        case "plausible":
          return await this._trackPlausiblePageView(path, options)
        case "umami":
          return await this._trackUmamiPageView(path, options)
        default:
          console.log(`[Analytics] Page view (${provider}):`, path, options)
          return { success: true, provider }
      }
    } catch (error) {
      console.error("[Analytics] Track pageview failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }
    }
  }

  /**
   * Obtiene el script tag para insertar en el HTML
   * Útil para SSR o inyección dinámica
   */
  getTrackingScript(): string | null {
    if (!this.enabled || !this.config) {
      return null
    }

    const { provider, trackingIdEncrypted, domain } = this.config

    switch (provider) {
      case "google": {
        let measurementId = trackingIdEncrypted ? decryptFromBase64(trackingIdEncrypted) : null
        if (this.config.googleConfig?.measurementId) {
          measurementId = this.config.googleConfig.measurementId
        }

        if (!measurementId) return null

        return `
          <!-- Google Analytics -->
          <script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              anonymize_ip: ${this.config.googleConfig?.anonymizeIp ?? true},
              send_page_view: ${this.config.googleConfig?.sendPageView ?? true}
            });
          </script>
        `
      }

      case "plausible": {
        const scriptUrl =
          this.config.plausibleConfig?.scriptUrl ?? "https://plausible.io/js/script.js"
        const dataDomain = this.config.plausibleConfig?.domain ?? domain ?? ""

        return `
          <!-- Plausible Analytics -->
          <script defer data-domain="${dataDomain}" src="${scriptUrl}"></script>
        `
      }

      case "umami": {
        const trackingId = trackingIdEncrypted ? decryptFromBase64(trackingIdEncrypted) : null
        // if (this.config.umamiConfig?.trackingId) {
        //   trackingId = this.config.umamiConfig.trackingId
        // }
        if (!trackingId) return null
        return `
          <!-- Umami Analytics -->
          <script defer src="https://cloud.umami.is/script.js" data-website-id="${trackingId}"></script>
        `
      }

      default:
        return null
    }
  }

  // ─────────────────────────────────────────────────────────
  // Métodos privados de implementación
  // ─────────────────────────────────────────────────────────

  private async _trackGoogleEvent(event: AnalyticsEvent): Promise<TrackResult> {
    // En el cliente: usar gtag
    if (typeof window !== "undefined" && (window as any).gtag) {
      ;(window as any).gtag("event", event.eventName, {
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        ...event.properties
      })
      return { success: true, provider: "google" }
    }

    // En el servidor: usar Measurement Protocol API
    const measurementId = this.config?.googleConfig?.measurementId
    if (!measurementId) {
      return { success: false, error: "Google Measurement ID not configured" }
    }

    // Implementación simplificada del Measurement Protocol
    const payload = {
      client_id: event.properties?.clientId ?? "server",
      events: [
        {
          name: event.eventName,
          params: {
            event_category: event.category,
            event_label: event.label,
            value: event.value,
            ...event.properties
          }
        }
      ]
    }

    // En producción, enviar a Google Analytics API
    // await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=YOUR_API_SECRET`, {
    //   method: "POST",
    //   body: JSON.stringify(payload)
    // })

    console.log("[GA4 Event]:", payload)
    return { success: true, provider: "google" }
  }

  private async _trackGooglePageView(
    path: string,
    options?: { title?: string; referrer?: string }
  ): Promise<TrackResult> {
    if (typeof window !== "undefined" && (window as any).gtag) {
      ;(window as any).gtag("config", this.config?.googleConfig?.measurementId ?? "", {
        page_path: path,
        page_title: options?.title,
        page_location: options?.referrer
      })
      return { success: true, provider: "google" }
    }

    console.log("[GA4 PageView]:", path, options)
    return { success: true, provider: "google" }
  }

  private async _trackPlausibleEvent(event: AnalyticsEvent): Promise<TrackResult> {
    if (typeof window !== "undefined" && (window as any).plausible) {
      ;(window as any).plausible(event.eventName, {
        props: event.properties
      })
      return { success: true, provider: "plausible" }
    }

    // Fallback: enviar a API de Plausible
    const apiEndpoint = this.config?.plausibleConfig?.apiEndpoint
    if (apiEndpoint) {
      await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: event.eventName,
          url: window?.location.href,
          props: event.properties
        })
      })
    }

    console.log("[Plausible Event]:", event)
    return { success: true, provider: "plausible" }
  }

  private async _trackPlausiblePageView(
    path: string,
    options?: { title?: string; referrer?: string }
  ): Promise<TrackResult> {
    if (typeof window !== "undefined" && (window as any).plausible) {
      ;(window as any).plausible("pageview")
      return { success: true, provider: "plausible" }
    }

    console.log("[Plausible PageView]:", path, options)
    return { success: true, provider: "plausible" }
  }

  private async _trackUmamiEvent(event: AnalyticsEvent): Promise<TrackResult> {
    if (typeof window !== "undefined" && (window as any).umami) {
      ;(window as any).umami.track(event.eventName, event.properties)
      return { success: true, provider: "umami" }
    }

    console.log("[Umami Event]:", event)
    return { success: true, provider: "umami" }
  }

  private async _trackUmamiPageView(
    path: string,
    options?: { title?: string }
  ): Promise<TrackResult> {
    if (typeof window !== "undefined" && (window as any).umami) {
      ;(window as any).umami.view(path)
      return { success: true, provider: "umami" }
    }

    console.log("[Umami PageView]:", path, options)
    return { success: true, provider: "umami" }
  }
}

export const analyticsModule = new AnalyticsModule()
