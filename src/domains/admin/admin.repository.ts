import { and, eq } from "drizzle-orm"
import type { ModuleConfig } from "@/utils/modules/module.types"
import type { UpdateSettingsInput } from "./admin.schema"

import { db } from "@/db"
import { settings } from "@/db/schema/settings"

export class AdminRepository {
  async getSetting(key: string) {
    return await db.select().from(settings).where(eq(settings.key, key))
  }

  async getSettings(category?: string) {
    if (category) {
      return await db.select().from(settings).where(eq(settings.category, category))
    }
    return await db.select().from(settings)
  }

  async updateSetting(data: UpdateSettingsInput) {
    await db
      .insert(settings)
      .values({
        key: data.key,
        value: data.value,
        category: data.category || "general"
      })
      .onDuplicateKeyUpdate({
        set: {
          value: data.value,
          updatedAt: new Date()
        }
      })
  }

  async listModules() {
    return await db.select().from(settings).where(eq(settings.category, "modules"))
  }

  async getModuleConfig(moduleName: string) {
    const key = `modules:${moduleName}`
    const [setting] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.category, "modules")))
    return setting?.value || null
  }

  async updateModuleConfig<T>(moduleName: string, config: ModuleConfig<T>): Promise<void> {
    const key = `modules:${moduleName}`
    await db
      .insert(settings)
      .values({
        key,
        category: "modules",
        value: config
      })
      .onDuplicateKeyUpdate({
        set: {
          value: config,
          updatedAt: new Date()
        }
      })
  }
}

export const adminRepository = new AdminRepository()
