import { BaseModule } from "../base.module"
import type { ShippingModuleConfig } from "./shipping.module.types"

export class ShippingModule extends BaseModule<ShippingModuleConfig> {
  constructor() {
    super("shipping")
  }

  /**
   * Calcula el costo de envío según las reglas configuradas
   * @param params Parámetros del pedido
   * @returns Objeto con costo, mensaje y disponibilidad
   */
  async calculateShippingCost(params: {
    postalCode: string
    province: string
    orderTotal: number
  }): Promise<{ cost: number; message?: string; available: boolean }> {
    await this.ensureInitialized()

    if (!this.enabled || !this.config) {
      return { cost: 0, available: false, message: "Envío no disponible" }
    }

    const { defaultCost, freeShippingThreshold, postalCodeRules, disabledProvinces } = this.config

    if (disabledProvinces?.includes(params.province)) {
      return { cost: 0, available: false, message: `No enviamos a ${params.province}` }
    }

    if (freeShippingThreshold && params.orderTotal >= freeShippingThreshold) {
      return { cost: 0, available: true, message: "¡Envío gratis!" }
    }

    if (postalCodeRules?.length) {
      const rule = postalCodeRules.find((r) => {
        if (r.pattern.startsWith("^") || r.pattern.endsWith("$")) {
          return new RegExp(r.pattern).test(params.postalCode)
        }
        return params.postalCode.startsWith(r.pattern)
      })
      if (rule) {
        return { cost: rule.cost, available: true, message: rule.label }
      }
    }

    return { cost: defaultCost ?? 0, available: true }
  }

  /**
   * Verifica si el envío está disponible para una provincia
   * @param province Provincia a verificar
   * @returns Objeto con disponibilidad y mensaje
   */
  async isAvailableForProvince(province: string): Promise<{
    available: boolean
    message?: string
  }> {
    await this.ensureInitialized()

    if (!this.enabled) {
      return { available: false, message: "Envío no habilitado" }
    }

    if (this.config?.disabledProvinces?.includes(province)) {
      return { available: false, message: `No enviamos a ${province}` }
    }

    return { available: true }
  }
}

export const shippingModule = new ShippingModule()
