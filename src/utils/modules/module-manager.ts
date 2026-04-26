import { and, eq } from "drizzle-orm"
import type { ModuleConfig } from "./module.types"

import { db } from "@/db"
import { settings } from "@/db/pg/settings"

/**
 * ModuleManager: Solo operaciones genéricas
 * NO contiene lógica específica de ningún módulo.
 */
export const moduleManager = {
  /**
   * Obtiene la configuración completa de un módulo
   * Estructura: { enabled: boolean, config: T, updatedAt?: string }
   */
  async getConfig<T>(moduleName: string): Promise<ModuleConfig<T> | null> {
    const key = `modules:${moduleName}`
    const [setting] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.category, "modules")))

    if (!setting) return null

    return setting.value as ModuleConfig<T>
  },

  /**
   * Verifica si un módulo está habilitado (solo lee el flag enabled)
   */
  async isEnabled(moduleName: string): Promise<boolean> {
    const config = await this.getConfig(moduleName)
    return config?.enabled === true
  },

  /**
   * Actualiza la configuración de un módulo (upsert)
   */
  async updateConfig<T>(
    moduleName: string,
    updates: Partial<ModuleConfig<T>>
  ): Promise<ModuleConfig<T>> {
    const key = `modules:${moduleName}`

    // 1. Obtener config existente (sin asumir tipo completo aún)
    const existing = await this.getConfig<T>(moduleName)

    // 2. Construir nuevo config SIN duplicar keys
    const mergedConfig: ModuleConfig<T> = {
      enabled: updates.enabled ?? existing?.enabled ?? false,
      config: {
        ...(existing?.config ?? {}),
        ...(updates.config ?? {})
      } as T,
      updatedAt: new Date().toISOString()
    }

    // 3. Upsert en DB (Postgres ON CONFLICT)
    await db
      .insert(settings)
      .values({
        key,
        category: "modules",
        value: mergedConfig
      })
      .onConflictDoUpdate({
        target: [settings.key],
        set: {
          value: mergedConfig,
          updatedAt: new Date()
        }
      })

    return mergedConfig
  }
}
