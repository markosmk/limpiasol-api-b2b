import type * as v from "valibot"
import type { Order, OrderItem, OrderItemInsert, OrderTimeline } from "@/db/pg"
import type {
  BillingData,
  DeliveryType,
  PickupLocationData,
  ShippingData
} from "@/db/pg/orders.types"
import type { GetOrdersQuerySchema } from "./orders.schema"

export interface AddressData {
  fullName: string
  addressLine1: string // Calle
  addressLine2?: string // Número, piso, depto
  city: string
  province: string
  postalCode: string
  // country?: string default Arg
  phone: string
  notes?: string
}

export interface CreateOrderItemInput extends Omit<OrderItemInsert, "orderId"> {
  // required
  productId: string
  productName: string
  productSku: string | null
  unitPrice: string
  quantity: number
  lineSubtotal: string
  // optional
  variantId: string
  // needed for snapshot
  // productImage?: string
  // variantName?: string
  // compareAtPrice?: string
  // tierType?: string
  // volumeDiscountApplied?: string
  // purchaseRules?: PurchaseRules | null
  // metadata?: any
}

export type OrderWithItems = Order & {
  items: OrderItem[]
  timeline?: OrderTimeline[]
}

// for repository
export type CreateOrderInput = {
  orderCode: string
  userId: string
  cartIdToConvert: string
  deliveryType: DeliveryType
  shippingData?: ShippingData // Snapshot de dirección de envío
  billingData?: BillingData // Snapshot de dirección de facturación
  pickupLocationData?: PickupLocationData // Solo si deliveryType = "pickup"
  subtotal: string // Decimal como string para precisión
  discounts?: string
  shippingCost?: string
  taxes?: string
  total: string
  observations?: string
  items: CreateOrderItemInput[]
}

// for service
export interface CreateOrderRequest {
  deliveryType: DeliveryType
  shippingData?: AddressData
  billingData?: BillingData
  pickupLocationData?: PickupLocationData
  observations?: string
  cartId?: string
}

// ─────────────────────────────────────────────────────────────
// Output de creación
// ─────────────────────────────────────────────────────────────
export interface CreateOrderResult {
  orderId: string
  orderCode: string
  total: string
}

// ─────────────────────────────────────────────────────────────
// Filtros para listar ordenes
// ─────────────────────────────────────────────────────────────

export type GetOrdersQueryFilters = v.InferOutput<typeof GetOrdersQuerySchema>
export type GetOrdersFilters = Omit<GetOrdersQueryFilters, "page"> & { offset?: number }

export interface GetOrdersResult {
  orders: Array<unknown>
  total: number
  hasMore: boolean
}

// ─────────────────────────────────────────────────────────────
// Eventos de timeline
// ─────────────────────────────────────────────────────────────
export interface TimelineEventMeta {
  [key: string]: unknown // Flexible según eventType
}
