export const productStatusValues = ["published", "draft", "inactive"] as const
export type ProductStatus = (typeof productStatusValues)[number]

export interface PurchaseRule {
  minQuantity: number
  maxQuantity?: number
  stepQuantity: number
  allowBackorder?: boolean
  unitName?: string
}

export interface VolumeDiscount {
  quantity: number
  discountPercent: number
}
