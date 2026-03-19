/**
 * Módulo de Envíos (Shipping)
 * Configura costos de envío, zonas, etc.
 */
export type ShippingModuleConfig = {
  /**
   * Costo de envío por defecto
   */
  defaultCost: number
  /**
   * Umbral para envío gratuito
   */
  freeShippingThreshold?: number
  /**
   * Reglas de costo por código postal
   * ej: [{
   *   pattern: "^1000$",
   *   cost: 0,
   *   label: "Retiro en sucursal"
   * }]
   * quiere decir que si el codigo postal es 1000 o 1001 el costo es 0 y la etiqueta es "Retiro en sucursal"
   */
  postalCodeRules?: Array<{
    pattern: string
    cost: number
    label?: string
  }>
  /**
   * Provincias deshabilitadas, no se puede enviar a estas provincias
   * ej: ["Tierra del Fuego"]
   */
  disabledProvinces?: string[]
}
