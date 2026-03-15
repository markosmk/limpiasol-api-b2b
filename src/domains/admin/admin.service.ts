import { adminRepository } from "./admin.repository"
import type { UpdateSettingsInput } from "./admin.schema"

export const adminService = {
  async getAllSettings(category?: string) {
    return await adminRepository.getSettings(category)
  },

  async updateSetting(data: UpdateSettingsInput) {
    await adminRepository.updateSetting(data)
  }
}
