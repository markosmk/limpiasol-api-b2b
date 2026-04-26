import { and, eq, sql } from "drizzle-orm"
import type { ModuleConfig } from "@/utils/modules/module.types"
import type { UpdateSettingsInput } from "./admin.schema"

import { db } from "@/db"
import { settings } from "@/db/pg/settings"

// Prepared statements for frequently-hit queries
const getSettingQuery = db
  .select()
  .from(settings)
  .where(eq(settings.key, sql.placeholder("key")))
  .prepare("admin_get_setting")

const getModuleConfigQuery = db
  .select()
  .from(settings)
  .where(and(eq(settings.key, sql.placeholder("key")), eq(settings.category, "modules")))
  .prepare("admin_get_module_config")

const listModulesQuery = db
  .select()
  .from(settings)
  .where(eq(settings.category, "modules"))
  .prepare("admin_list_modules")

export class AdminRepository {
  async getSetting(key: string) {
    return await getSettingQuery.execute({ key })
  }

  async getSettings(category?: string) {
    if (category) {
      return await db.select().from(settings).where(eq(settings.category, category))
    }
    return await db.select().from(settings)
  }

  async updateSetting(data: UpdateSettingsInput) {
    // Postgres upsert via ON CONFLICT on primary key
    await db
      .insert(settings)
      .values({
        key: data.key,
        value: data.value,
        category: data.category || "general"
      })
      .onConflictDoUpdate({
        target: [settings.key],
        set: {
          value: data.value,
          updatedAt: new Date()
        }
      })
  }

  async listModules() {
    return await listModulesQuery.execute()
  }

  async getModuleConfig(moduleName: string) {
    const key = `modules:${moduleName}`
    const [setting] = await getModuleConfigQuery.execute({ key })
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
      .onConflictDoUpdate({
        target: [settings.key],
        set: {
          value: config,
          updatedAt: new Date()
        }
      })
  }
}

export const adminRepository = new AdminRepository()
