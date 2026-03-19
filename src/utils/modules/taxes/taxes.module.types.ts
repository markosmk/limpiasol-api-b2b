/**
 * Módulo de Impuestos (Taxes)
 * Configura tasas por provincia, categorías exentas, etc.
 */
export type TaxesModuleConfig = {
  /**
   * Tasa de impuesto por defecto (ej: 0.21 = 21% IVA)
   * Si es 0, no se aplican impuestos
   */
  defaultRate: number

  /**
   * Tasas específicas por provincia
   * Ej: Ingresos Brutos varía según jurisdicción
   */
  provincialRates?: Array<{
    province: string // "Buenos Aires", "CABA", "Córdoba", etc.
    rate: number // 0.03 = 3%
    concept?: string // "Ingresos Brutos", "IVA Provincial", etc.
    description?: string // Nota explicativa para el admin
  }>

  /**
   * IDs de categorías de productos exentas de impuestos
   * Ej: ["cat_libros", "cat_alimentos_basicos"]
   */
  exemptCategories?: string[]

  /**
   * Monto mínimo para aplicar impuestos (ej: compras menores no tributan)
   */
  minTaxableAmount?: number

  /**
   * Si es true, los impuestos se incluyen en el precio mostrado (IVA incluido)
   * Si es false, se agregan al final como línea separada
   */
  taxesIncludedInPrice?: boolean
}
