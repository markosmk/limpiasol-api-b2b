import { moduleManager } from "./module-manager"

import { appEvents, EventTypes } from "@/events/emitter"

/**
 * Clase base para todos los módulos
 *
 * Patrón: Template Method + Generic
 * - Maneja lazy loading, cache y refresh de config
 * - Cada módulo específico extiende esta clase y solo implementa su lógica de negocio
 *
 * @template TConfig - Tipo de la configuración específica del módulo (sin wrapper)
 */
export abstract class BaseModule<TConfig> {
  /**
   * Configuración específica del módulo (tipada con TConfig)
   * Accesible solo para subclases (protected)
   */
  protected config: TConfig | null = null

  /**
   * ¿Está habilitado el módulo?
   */
  protected enabled: boolean = false

  /**
   * ¿Ya se cargó la config desde DB?
   */
  protected initialized: boolean = false

  /**
   * @param moduleName - Nombre del módulo para lookup en DB (ej: "taxes", "shipping")
   */
  constructor(protected moduleName: string) {
    // cada módulo se suscribe a sus propias actualizaciones al nacer
    appEvents.on(EventTypes.MODULE_CONFIG_UPDATED, (updatedModuleName) => {
      if (this.moduleName === updatedModuleName) {
        console.log(`[BaseModule] Recargando caché para módulo: ${this.moduleName}`)
        this.refreshConfig().catch(console.error)
      }
    })
  }

  /**
   * Carga la configuración desde DB (solo la primera vez)
   * Lazy loading: no consulta hasta que se necesite
   *
   * Las subclases deben llamar a este método al inicio de sus métodos públicos
   * o podemos hacerlo automático con un decorator (futuro)
   */
  protected async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    const moduleConfig = await moduleManager.getConfig<TConfig>(this.moduleName)
    this.enabled = moduleConfig?.enabled ?? false
    this.config = moduleConfig?.config ?? null
    this.initialized = true
  }

  /**
   * Recarga la configuración desde DB (útil si el admin la actualizó)
   */
  async refreshConfig(): Promise<void> {
    this.initialized = false
    await this.ensureInitialized()
  }

  /**
   * Getter público para verificar si está habilitado
   * Útil para checks rápidos sin cargar toda la config
   */
  public isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Helper para validar que el módulo esté habilitado antes de ejecutar lógica
   * Lanza error si no está habilitado (opcional, según necesidad)
   */
  protected requireEnabled(errorMessage?: string): void {
    if (!this.enabled) {
      throw new Error(errorMessage ?? `Module "${this.moduleName}" is not enabled`)
    }
  }
}
