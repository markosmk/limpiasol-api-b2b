import type { PurchaseRule } from "@/db/schema/products.types"

export type ProductSummary = {
  id: string
  name: string
  sku: string | null
  purchaseRules: PurchaseRule | null
  status: "published" | "draft" | "inactive"
  images: {
    id: string
    url: string
    alt: string | null
    isPrimary: boolean | null
  }[]
}

export type ProductWithDetails = ProductSummary & {
  variants: Array<{
    id: string
    name: string
    sku: string
    options: Record<string, string>
  }>
  primaryImage: {
    id: string
    url: string
    alt: string | null
    isPrimary: boolean | null
  } | null
}

export type ProductPayload = {
  name?: string
  description?: string
  status?: "published" | "draft" | "inactive"
  purchaseRules?: PurchaseRule
  images?: {
    id: string
    url: string
    alt: string | null
    isPrimary: boolean | null
  }[]
  variants?: Array<{
    id: string
    name: string
    sku: string
    options: Record<string, string>
  }>
  pricing?: Array<{
    id: string
    name: string
    sku: string
    options: Record<string, string>
  }>
}
