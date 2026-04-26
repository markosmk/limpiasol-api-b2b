import type { OrderStatus } from "@/db/pg/orders.types"
import type { PurchaseRule } from "@/db/pg/products.types"
import type { PricingResult } from "@/domains/products/pricing/pricing.types"

// ─────────────────────────────────────────────────────────────
// Generar orderCode legible (8 chars alfanuméricos)
// ─────────────────────────────────────────────────────────────
export function generateOrderCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Sin I, O, 0, 1 para evitar confusión
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// ─────────────────────────────────────────────────────────────
// Validar transición de estados (máquina de estados simple)
// ─────────────────────────────────────────────────────────────
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["adjusting", "pending_payment", "cancelled"],
  adjusting: ["pending", "pending_payment", "cancelled"],
  pending_payment: ["paid", "adjusting", "cancelled"],
  paid: ["shipped", "ready_pickup", "cancelled"],
  shipped: ["delivered", "cancelled"],
  ready_pickup: ["delivered", "cancelled"],
  delivered: [], // Terminal
  cancelled: [] // Terminal
}

export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function getStatusTransitionError(from: OrderStatus, to: OrderStatus): string {
  if (from === to) return "El estado ya es el mismo"
  if (!isValidStatusTransition(from, to)) {
    return `No se puede cambiar de "${from}" a "${to}". Transiciones válidas: ${VALID_TRANSITIONS[from].join(", ") || "ninguna"}`
  }
  return ""
}

// ─────────────────────────────────────────────────────────────
// Calcular totales (función pura, fácil de testear)
// ─────────────────────────────────────────────────────────────
interface CalculateTotalsInput {
  lineSubtotals: string[] // ["100.00", "250.50", ...]
  discounts?: string
  shippingCost?: string
  taxes?: string
}

export function calculateOrderTotals(input: CalculateTotalsInput): {
  subtotal: string
  discounts: string
  shippingCost: string
  taxes: string
  total: string
} {
  const subtotal = input.lineSubtotals.reduce((sum, val) => sum + parseFloat(val), 0)
  const discounts = parseFloat(input.discounts ?? "0")
  const shippingCost = parseFloat(input.shippingCost ?? "0")
  const taxes = parseFloat(input.taxes ?? "0")

  const total = subtotal - discounts + shippingCost + taxes

  // Retornar como string con 2 decimales para precisión en DB decimal(12,2)
  return {
    subtotal: subtotal.toFixed(2),
    discounts: discounts.toFixed(2),
    shippingCost: shippingCost.toFixed(2),
    taxes: taxes.toFixed(2),
    total: total.toFixed(2)
  }
}

// ─────────────────────────────────────────────────────────────
// Formatear fecha/hora para pickup (validación simple)
// ─────────────────────────────────────────────────────────────
export function isValidPickupSchedule(date: string, time: string): boolean {
  // date: "YYYY-MM-DD", time: "HH:MM"
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

  if (!dateRegex.test(date) || !timeRegex.test(time)) return false

  const scheduled = new Date(`${date}T${time}:00`)
  const now = new Date()
  return scheduled >= now // No permitir fechas pasadas
}

export interface ProductSnapshotInput {
  product: {
    id: string
    name: string
    // sku: string | null
    image?: string | null
    purchaseRules: PurchaseRule | null
  }
  variant?: {
    id: string
    name: string | null
    sku: string | null
    image?: string | null
  } | null
  pricing: PricingResult
  quantity: number
}

export interface OrderItemSnapshot {
  productId: string
  variantId: string
  productName: string
  productSku: string | null
  productImage?: string
  variantName?: string
  variantSku?: string
  unitPrice: string
  compareAtPrice?: string
  tierType: string
  quantity: number
  volumeDiscountApplied: string
  lineSubtotal: string
  purchaseRules: PurchaseRule | null
  metadata: Record<string, unknown> | null
}

/**
 * Crea el snapshot estático de un item para orderItems
 * Función PURA: sin efectos secundarios, fácil de testear
 */
export function buildOrderItemSnapshot(input: ProductSnapshotInput): OrderItemSnapshot {
  const { product, variant, pricing, quantity } = input

  // Calcular descuento por volumen aplicado en moneda
  const volumeDiscountAmount =
    pricing.hasDiscount && pricing.volumeDiscount
      ? (pricing.unitPrice * quantity * pricing.volumeDiscount.discountPercent) / 100
      : 0

  return {
    productId: product.id,
    variantId: variant?.id ?? "",
    // Datos congelados del producto
    productName: product.name,
    productSku: null, // Si no se provee o no existe
    productImage: variant?.image ?? product.image ?? undefined,
    variantName: variant?.name ?? undefined,
    variantSku: variant?.sku ?? "",
    // Datos congelados de pricing
    unitPrice: pricing.unitPrice.toFixed(2),
    compareAtPrice: pricing.originalPrice ? pricing.originalPrice.toFixed(2) : undefined,
    tierType: pricing.appliedTier,
    // Cálculos de línea
    quantity,
    volumeDiscountApplied: volumeDiscountAmount.toFixed(2),
    lineSubtotal: pricing.finalSubtotal.toFixed(2), // Ya incluye descuento por volumen
    purchaseRules: product.purchaseRules,
    metadata: null
  }
}
