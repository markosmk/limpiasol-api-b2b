export const orderStatusValues = [
  "pending", // Recién creado, admin debe revisar
  "adjusting", // Admin está editando AHORA (bloqueado para usuario)
  "pending_payment", // Revisado por admin, esperando pago
  "paid", // Pago confirmado → listo para acción física
  "shipped", // Enviado (solo deliveryType = "shipping")
  "ready_pickup", // Listo para retiro (solo deliveryType = "pickup")
  "delivered", // Entregado al cliente
  "cancelled" // Cancelado
] as const
export type OrderStatus = (typeof orderStatusValues)[number]

export const deliveryTypeValues = ["shipping", "pickup"] as const
export type DeliveryType = (typeof deliveryTypeValues)[number]

export const timelineEventValues = [
  "order_created",
  "status_changed",
  "payment_confirmed",
  "shipping_updated",
  "pickup_scheduled",
  "pickup_rescheduled",
  "cancelled",
  "reactivated",
  "admin_note",
  // for adjusting
  "items_adjusted",
  "price_adjusted",
  "delivery_updated"
] as const
export type TimelineEvent = (typeof timelineEventValues)[number]

export interface PickupLocationData {
  // from sucursal
  locationId: string
  locationName: string
  address: string
  openingHours?: string
  phone?: string
  // from cliente
  scheduledDate: string // "YYYY-MM-DD"
  scheduledTime: string // "HH:MM" formato 24h
  notes?: string
}

// Type for shipping data JSON
export interface ShippingData {
  fullName: string
  addressLine1: string // Street
  addressLine2?: string // Number, floor, apartment
  city: string
  province: string // state
  postalCode: string
  // country: string;
  phone: string
  notes?: string
}

// Type for billing data JSON
export interface BillingData {
  useSameAsShipping?: boolean
  fullName?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  phone?: string
  notes?: string
  // fiscal data
  cuit?: string
  ivaCategory?: string
  // taxId?: string; same cuit
}

export interface InternalNote {
  id: string
  content: string
  createdAt: Date
  createdBy: {
    id: string
    name: string
  }
  type?: "general" | "urgent" | "customer" | "logistics"
}
