export type UserTier = "retail" | "wholesale" | "reseller" | "vip"

export type PricingContext = {
  productId: string
  variantId: string
  userTier: UserTier
  quantity: number
}

export type PricingResult = {
  unitPrice: number
  originalPrice: number
  appliedTier: UserTier
  finalSubtotal: number
  currency: string
  // minQuantity: number
  volumeDiscount?: { quantity: number; discountPercent: number }
  hasDiscount: boolean
  discountPercent: number
}

export type PriceValidationResult = {
  valid: boolean
  error?: string
  suggestion?: string
  code?: string
}
