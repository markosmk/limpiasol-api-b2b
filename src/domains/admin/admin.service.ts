import { type AdminRepository, adminRepository } from "./admin.repository"
import type { ModuleConfig } from "@/utils/modules/module.types"
import type { ModuleName } from "@/utils/modules/module-schemas"
import type { UpdateSettingsInput } from "./admin.schema"

import { appEvents, EventTypes } from "@/events/emitter"

export class AdminService {
  constructor(private adminRepository: AdminRepository) {}

  async getSetting(key: string) {
    const data = await this.adminRepository.getSetting(key)
    return data?.[0]?.value ?? null
  }

  async getAllSettings(category?: string): Promise<Record<string, unknown>> {
    const settings = await this.adminRepository.getSettings(category)
    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value
        return acc
      },
      {} as Record<string, unknown>
    )
  }

  async updateSetting(data: UpdateSettingsInput) {
    await this.adminRepository.updateSetting(data)
  }

  async getModule(moduleName: ModuleName) {
    return await this.adminRepository.getModuleConfig(moduleName)
  }

  async listModules() {
    const installed = await this.adminRepository.listModules()
    return installed.map((s) => ({
      enabled: (s.value as ModuleConfig<unknown>)?.enabled,
      name: s.key.replace("modules:", "")
    }))
  }

  async updateModuleConfig<T>(
    moduleName: string,
    validatedConfig: ModuleConfig<T>
  ): Promise<ModuleConfig<T>> {
    const moduleConfig = {
      ...validatedConfig,
      updatedAt: new Date().toISOString()
    }

    await this.adminRepository.updateModuleConfig(moduleName, moduleConfig)

    // reload module cache if exists
    appEvents.emit(EventTypes.MODULE_CONFIG_UPDATED, moduleName)

    return moduleConfig
  }
}

export const adminService = new AdminService(adminRepository)
