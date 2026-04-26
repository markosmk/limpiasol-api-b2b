import type { PurchaseRule } from "@/db/pg/products.types"

export type ProductSummary = {
  id: string
  name: string
  purchaseRules: PurchaseRule | null
  status: "published" | "draft" | "inactive"
  images: {
    id: string
    url: string
    alt: string | null
    isPrimary: boolean | null
  }[]
}
