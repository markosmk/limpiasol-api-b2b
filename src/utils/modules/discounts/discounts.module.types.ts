/**
 * Tipos de descuento disponibles
 */
export type DiscountType = "percentage" | "fixed" | "free_shipping"

export type CouponCode = {
  code: string
  type: DiscountType
  value: number
  validFrom?: string // ISO date
  validUntil?: string // ISO date
  minPurchase?: number
  maxUses?: number
  currentUses?: number
  description?: string
}

/**
 * Configuración del módulo de descuentos
 */
export type DiscountsModuleConfig = {
  /**
   * Descuento por defecto (para tipo "percentage": 0.10 = 10%)
   * Para tipo "fixed": monto en pesos
   */
  defaultDiscount: number

  /**
   * Tipo de descuento por defecto
   */
  defaultType: DiscountType

  /**
   * Descuentos específicos por categoría
   * Ej: [{ categoryId: "cat_electronics", type: "percentage", value: 0.15 }]
   */
  categoryDiscounts?: Array<{
    categoryId: string
    type: DiscountType
    value: number
    label?: string // "15% OFF en Electrónica"
  }>

  /**
   * Monto mínimo de compra para aplicar descuentos
   */
  minPurchaseAmount?: number

  /**
   * Monto máximo de descuento (para evitar abusos)
   * En porcentaje: 0.50 = 50% del subtotal
   * En fixed: monto máximo en pesos
   */
  maxDiscountAmount?: number

  /**
   * Descuento máximo en monto absoluto (siempre aplica)
   * Ej: nunca descontar más de $10,000
   */
  absoluteMaxDiscount?: number

  /**
   * Si es true, los descuentos son acumulables
   * Si es false, solo se aplica el mayor
   */
  allowStacking?: boolean

  /**
   * Códigos de cupón válidos (opcional, para validación manual)
   */
  validCouponCodes?: Array<CouponCode>
}

/**
 * Resultado del cálculo de descuento
 */
export type DiscountResult = {
  /**
   * Monto del descuento aplicado
   */
  amount: number

  /**
   * Porcentaje aplicado (si aplica)
   */
  percentage?: number

  /**
   * Detalle de descuentos aplicados
   */
  breakdown: Array<{
    type: DiscountType
    value: number
    label?: string
    amount: number
  }>

  /**
   * Si se aplicó algún descuento
   */
  hasDiscount: boolean

  /**
   * Código de cupón aplicado (si existe)
   */
  couponCode?: string

  /**
   * Mensaje para mostrar al usuario
   */
  message?: string
}

/**
 * Parámetros para calcular descuento
 */
export type CalculateDiscountParams = {
  /**
   * Subtotal del pedido (antes de descuentos)
   */
  subtotal: number

  /**
   * IDs de categorías de los items
   */
  categoryIds?: string[]

  /**
   * Código de cupón (opcional)
   */
  couponCode?: string

  /**
   * Provincia (para validar free_shipping)
   */
  province?: string

  /**
   * Tipo de entrega
   */
  deliveryType?: "shipping" | "pickup"
}
