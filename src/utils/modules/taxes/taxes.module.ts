import { BaseModule } from "../base.module"
import type { TaxesModuleConfig } from "./taxes.module.types"

/**
 * Módulo de Impuestos
 *
 * Extiende BaseModule<TaxesModuleConfig> para heredar:
 * - Lazy loading de config
 * - Cache en memoria
 * - Método refreshConfig()
 *
 * Solo implementa la lógica específica de taxes.
 */
export class TaxesModule extends BaseModule<TaxesModuleConfig> {
  constructor() {
    super("taxes") // lookup en DB: key = "modules:taxes"
  }

  /**
   * Calcula impuestos para un pedido
   *
   * @returns
   * - taxesIncluded: true si los impuestos ya están en el precio mostrado
   * - breakdown: array con detalle de impuestos aplicados
   */
  async calculateTaxes(params: {
    province: string
    subtotal: number
    discounts?: number
    categoryIds?: string[]
  }): Promise<{
    amount: number
    breakdown: Array<{ concept: string; rate: number; amount: number; description?: string }>
    taxesIncluded: boolean
  }> {
    await this.ensureInitialized()

    // Si no está habilitado, retornar sin impuestos
    if (!this.enabled || !this.config) {
      return { amount: 0, breakdown: [], taxesIncluded: false }
    }

    const {
      defaultRate,
      provincialRates,
      exemptCategories,
      minTaxableAmount,
      taxesIncludedInPrice
    } = this.config

    // Si los impuestos están incluidos en el precio, no calcular aparte
    if (taxesIncludedInPrice) {
      return { amount: 0, breakdown: [], taxesIncluded: true }
    }

    // Verificar monto mínimo tributable
    if (minTaxableAmount && params.subtotal < minTaxableAmount) {
      return { amount: 0, breakdown: [], taxesIncluded: false }
    }

    // Verificar exención por categoría
    if (exemptCategories?.some((catId) => params.categoryIds?.includes(catId))) {
      return { amount: 0, breakdown: [], taxesIncluded: false }
    }

    // Buscar tasa provincial específica
    const provincialRule = provincialRates?.find((r) => r.province === params.province)
    const rate = provincialRule?.rate ?? defaultRate
    const concept = provincialRule?.concept ?? "IVA"

    // Calcular sobre base imponible (subtotal - descuentos)
    const taxableBase = params.subtotal - (params.discounts ?? 0)
    const taxAmount = taxableBase * rate

    return {
      amount: parseFloat(taxAmount.toFixed(2)),
      breakdown: [
        {
          concept,
          rate,
          amount: parseFloat(taxAmount.toFixed(2)),
          ...(provincialRule?.description && { description: provincialRule.description })
        }
      ],
      taxesIncluded: false
    }
  }

  /**
   * Obtiene la tasa de impuesto para una provincia (para mostrar en UI)
   */
  async getTaxRateForProvince(province: string): Promise<{
    rate: number
    concept: string
    description?: string
    enabled: boolean
  }> {
    await this.ensureInitialized()

    if (!this.enabled || !this.config) {
      return { rate: 0, concept: "Sin impuestos", enabled: false }
    }

    const { defaultRate, provincialRates } = this.config
    const provincialRule = provincialRates?.find((r) => r.province === province)

    return {
      rate: provincialRule?.rate ?? defaultRate,
      concept: provincialRule?.concept ?? "IVA",
      description: provincialRule?.description,
      enabled: true
    }
  }

  //       /**
  //        * después de crear pedido: registrar en sistema contable (ejemplo)
  //        */
  //       afterOrderCreated: async (payload) => {
  //         // Aquí podrías integrar con un sistema contable externo
  //         // Ej: enviar a AFIP, Xero, QuickBooks, etc.
  //         console.log("[TaxesModule] Order created, ready for tax reporting", {
  //           orderId: payload.orderId,
  //           total: payload.total
  //         })

  //         // Ejemplo ficticio de integración:
  //         // await accountingApi.reportSale({ orderId: payload.orderId, amount: payload.total })
  //       }
}

/**
 * Singleton: Una sola instancia para toda la app
 * Se inicializa lazy (la primera vez que se usa)
 */
export const taxesModule = new TaxesModule()
