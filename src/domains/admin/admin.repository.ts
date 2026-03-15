import { eq } from "drizzle-orm"
import type { UpdateSettingsInput } from "./admin.schema"

import { db } from "@/db"
import { settings } from "@/db/schema/settings"

export const adminRepository = {
  async getSettings(category?: string) {
    if (category) {
      return await db.select().from(settings).where(eq(settings.category, category))
    }
    return await db.select().from(settings)
  },

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
}
