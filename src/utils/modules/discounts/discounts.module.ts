import { BaseModule } from "../base.module"
import type {
  CalculateDiscountParams,
  CouponCode,
  DiscountResult,
  DiscountsModuleConfig
} from "./discounts.module.types"

/**
 * Módulo de Descuentos y Cupones
 *
 * Características:
 * - Descuentos porcentuales o fijos
 * - Descuentos por categoría
 * - Cupones con validez temporal
 * - Límites de monto mínimo/máximo
 * - Acumulación configurable
 */
export class DiscountsModule extends BaseModule<DiscountsModuleConfig> {
  constructor() {
    super("discounts")
  }

  /**
   * Calcula el descuento para un pedido
   *
   * @example
   * const discount = await discountsModule.calculateDiscount({
   *   subtotal: 10000,
   *   categoryIds: ["cat_electronics"],
   *   couponCode: "HOLAMUNDO"
   * })
   *
   * // discount.amount → 1500 (15% OFF)
   * // discount.breakdown → [{ type: "percentage", value: 0.15, amount: 1500 }]
   */
  async calculateDiscount(params: CalculateDiscountParams): Promise<DiscountResult> {
    await this.ensureInitialized()

    if (!this.enabled || !this.config) {
      return {
        amount: 0,
        breakdown: [],
        hasDiscount: false
      }
    }

    const {
      defaultDiscount,
      defaultType,
      categoryDiscounts,
      minPurchaseAmount,
      maxDiscountAmount,
      absoluteMaxDiscount,
      allowStacking,
      validCouponCodes
    } = this.config

    const breakdown: DiscountResult["breakdown"] = []
    let totalDiscount = 0
    let appliedCoupon: CouponCode | undefined

    // 1. Verificar monto mínimo
    if (minPurchaseAmount && params.subtotal < minPurchaseAmount) {
      return {
        amount: 0,
        breakdown: [],
        hasDiscount: false,
        message: `Monto mínimo de compra: $${minPurchaseAmount}`
      }
    }

    // 2. Validar cupón si se proporcionó
    if (params.couponCode && validCouponCodes?.length) {
      const coupon = validCouponCodes.find(
        (c) => c.code.toUpperCase() === params.couponCode!.toUpperCase()
      )

      if (!coupon) {
        return {
          amount: 0,
          breakdown: [],
          hasDiscount: false,
          message: "Cupón inválido"
        }
      }

      // Verificar fecha de validez
      const now = new Date()
      if (coupon.validFrom && new Date(coupon.validFrom) > now) {
        return {
          amount: 0,
          breakdown: [],
          hasDiscount: false,
          message: "Cupón aún no válido"
        }
      }
      if (coupon.validUntil && new Date(coupon.validUntil) < now) {
        return {
          amount: 0,
          breakdown: [],
          hasDiscount: false,
          message: "Cupón expirado"
        }
      }

      // Verificar usos máximos
      if (coupon.maxUses && (coupon.currentUses ?? 0) >= coupon.maxUses) {
        return {
          amount: 0,
          breakdown: [],
          hasDiscount: false,
          message: "Cupón agotado"
        }
      }

      // Verificar monto mínimo del cupón
      if (coupon.minPurchase && params.subtotal < coupon.minPurchase) {
        return {
          amount: 0,
          breakdown: [],
          hasDiscount: false,
          message: `Monto mínimo para este cupón: $${coupon.minPurchase}`
        }
      }

      // Aplicar cupón
      appliedCoupon = coupon
      const couponAmount = this._calculateDiscountAmount(params.subtotal, coupon.type, coupon.value)

      breakdown.push({
        type: coupon.type,
        value: coupon.value,
        amount: couponAmount,
        label: `Cupón ${coupon.code}`
      })
      totalDiscount += couponAmount
    }

    // 3. Aplicar descuentos por categoría (si no hay cupón o allowStacking)
    if (!appliedCoupon || allowStacking) {
      const applicableCategories =
        categoryDiscounts?.filter((cat) => params.categoryIds?.includes(cat.categoryId)) ?? []

      for (const catDiscount of applicableCategories) {
        const catAmount = this._calculateDiscountAmount(
          params.subtotal,
          catDiscount.type,
          catDiscount.value
        )

        breakdown.push({
          type: catDiscount.type,
          value: catDiscount.value,
          amount: catAmount,
          label: catDiscount.label
        })
        totalDiscount += catAmount

        if (!allowStacking) break // Solo el primero si no permite acumular
      }

      // Si no hay descuentos por categoría, aplicar default
      if (applicableCategories.length === 0 && !appliedCoupon) {
        const defaultAmount = this._calculateDiscountAmount(
          params.subtotal,
          defaultType,
          defaultDiscount
        )

        if (defaultAmount > 0) {
          breakdown.push({
            type: defaultType,
            value: defaultDiscount,
            amount: defaultAmount,
            label:
              defaultType === "percentage"
                ? `${(defaultDiscount * 100).toFixed(0)}% OFF`
                : `$${defaultDiscount.toFixed(2)} OFF`
          })
          totalDiscount += defaultAmount
        }
      }
    }

    // 4. Aplicar límites
    if (maxDiscountAmount) {
      const maxByPercentage = params.subtotal * maxDiscountAmount
      if (totalDiscount > maxByPercentage) {
        totalDiscount = maxByPercentage
      }
    }

    if (absoluteMaxDiscount && totalDiscount > absoluteMaxDiscount) {
      totalDiscount = absoluteMaxDiscount
    }

    // 5. Free shipping (si aplica)
    if (params.deliveryType === "shipping" && breakdown.some((b) => b.type === "free_shipping")) {
      // El shipping se maneja en shipping.module, aquí solo marcamos
      return {
        amount: totalDiscount,
        percentage: defaultType === "percentage" ? defaultDiscount : undefined,
        breakdown,
        hasDiscount: totalDiscount > 0,
        couponCode: appliedCoupon?.code,
        message: "¡Envío gratis aplicado!"
      }
    }

    return {
      amount: parseFloat(totalDiscount.toFixed(2)),
      percentage: defaultType === "percentage" ? defaultDiscount : undefined,
      breakdown,
      hasDiscount: totalDiscount > 0,
      couponCode: appliedCoupon?.code,
      message: breakdown.length > 0 ? `Descuento aplicado: $${totalDiscount.toFixed(2)}` : undefined
    }
  }

  /**
   * Valida un código de cupón sin aplicarlo
   * Útil para mostrar mensaje en el checkout
   */
  async validateCouponCode(couponCode: string): Promise<{
    valid: boolean
    message?: string
    discount?: { type: string; value: number }
  }> {
    await this.ensureInitialized()

    if (!this.enabled || !this.config?.validCouponCodes) {
      return { valid: false, message: "Cupones no disponibles" }
    }

    const coupon = this.config.validCouponCodes.find(
      (c) => c.code.toUpperCase() === couponCode.toUpperCase()
    )

    if (!coupon) {
      return { valid: false, message: "Cupón inválido" }
    }

    const now = new Date()
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return { valid: false, message: "Cupón aún no válido" }
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return { valid: false, message: "Cupón expirado" }
    }
    if (coupon.maxUses && (coupon.currentUses ?? 0) >= coupon.maxUses) {
      return { valid: false, message: "Cupón agotado" }
    }

    return {
      valid: true,
      message: coupon.description ?? "Cupón válido",
      discount: {
        type: coupon.type,
        value: coupon.value
      }
    }
  }

  /**
   * Incrementa el contador de usos de un cupón
   * Debe llamarse después de crear el pedido exitosamente
   */
  async incrementCouponUsage(couponCode: string): Promise<void> {
    await this.ensureInitialized()

    if (!this.config?.validCouponCodes) return

    const coupon = this.config.validCouponCodes.find(
      (c) => c.code.toUpperCase() === couponCode.toUpperCase()
    )

    if (coupon) {
      coupon.currentUses = (coupon.currentUses ?? 0) + 1
      // Aquí podrías persistir el cambio en DB si es necesario
    }
  }

  /**
   * Helper interno para calcular monto de descuento
   */
  private _calculateDiscountAmount(
    subtotal: number,
    type: "percentage" | "fixed" | "free_shipping",
    value: number
  ): number {
    if (type === "percentage") {
      return subtotal * value
    } else if (type === "fixed") {
      return Math.min(value, subtotal) // No puede ser mayor al subtotal
    }
    return 0 // free_shipping se maneja aparte
  }

  /**
   * Obtiene todos los cupones activos (para mostrar en UI)
   */
  async getActiveCoupons(): Promise<
    Array<{
      code: string
      description?: string
      discount: string
      validUntil?: string
      minPurchase?: number
    }>
  > {
    await this.ensureInitialized()

    if (!this.enabled || !this.config?.validCouponCodes) {
      return []
    }

    const now = new Date()

    return this.config.validCouponCodes
      .filter(
        (c) =>
          (!c.validFrom || new Date(c.validFrom) <= now) &&
          (!c.validUntil || new Date(c.validUntil) >= now) &&
          (!c.maxUses || (c.currentUses ?? 0) < c.maxUses)
      )
      .map((c) => ({
        code: c.code,
        description: c.description,
        discount:
          c.type === "percentage"
            ? `${(c.value * 100).toFixed(0)}% OFF`
            : c.type === "fixed"
              ? `$${c.value.toFixed(2)} OFF`
              : "Envío Gratis",
        validUntil: c.validUntil,
        minPurchase: c.minPurchase
      }))
  }
}

export const discountsModule = new DiscountsModule()
