/**
 * Providers de analytics soportados
 */
export type AnalyticsProvider = "google" | "plausible" | "umami" | "custom"

/**
 * Configuración del módulo de analytics
 */
export type AnalyticsModuleConfig = {
  /**
   * Provider a utilizar
   */
  provider: AnalyticsProvider

  /**
   * ID de tracking (GA4, Plausible, etc.)
   */
  trackingId?: string

  /**
   * Dominio para analytics (opcional)
   */
  domain?: string

  /**
   * Si es true, no rastrear usuarios logueados (privacidad)
   */
  excludeLoggedInUsers?: boolean

  /**
   * Si es true, respetar Do Not Track del navegador
   */
  respectDoNotTrack?: boolean

  /**
   * Eventos personalizados a trackear
   */
  customEvents?: Array<{
    name: string
    category?: string
    label?: string
  }>

  /**
   * Configuración específica de Google Analytics
   */
  googleConfig?: {
    measurementId: string
    gtagScript?: string // URL del script, default: https://www.googletagmanager.com/gtag/js
    anonymizeIp?: boolean
    sendPageView?: boolean
  }

  /**
   * Configuración específica de Plausible
   */
  plausibleConfig?: {
    domain: string
    scriptUrl?: string // Default: https://plausible.io/js/script.js
    apiEndpoint?: string // Para eventos personalizados
  }
}

/**
 * Evento de analytics para trackear
 */
export type AnalyticsEvent = {
  /**
   * Nombre del evento
   */
  eventName: string

  /**
   * Categoría del evento (opcional)
   */
  category?: string

  /**
   * Label del evento (opcional)
   */
  label?: string

  /**
   * Valor numérico (opcional)
   */
  value?: number

  /**
   * Propiedades adicionales (opcional)
   */
  properties?: Record<string, unknown>
}

/**
 * Resultado del trackeo
 */
export type TrackResult = {
  success: boolean
  error?: string
  provider?: AnalyticsProvider
}
