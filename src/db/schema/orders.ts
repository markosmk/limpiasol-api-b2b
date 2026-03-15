import { createId } from "@paralleldrive/cuid2"
import {
  char,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core"
import { users } from "./users"

// Order status enum values
export const orderStatusValues = [
  "pending", // Recién creado, admin debe revisar
  "adjusting", // Admin está editando AHORA (bloqueado)
  "pending_payment", // Revisado por admin, esperando pago,
  "paid", // Pago confirmado, cuando el admin marca paid, el pedido está listo para la acción física (retirar o enviar).
  "shipped", // Enviado (solo para deliveryType = "shipping")
  "ready_pickup", // Listo para retiro (solo para deliveryType = "pickup")
  "delivered", // Entregado al cliente
  "cancelled" // Cancelado
] as const

// Delivery type enum values
export const deliveryTypeValues = ["shipping", "pickup"] as const

export const orders = mysqlTable(
  "orders",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),

    // internal use, for contable reports, or export to excel/afip
    orderNumber: serial("order_number"),
    orderCode: char("order_code", { length: 8 }).notNull().unique(),

    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    status: mysqlEnum("status", orderStatusValues).notNull().default("pending"),
    deliveryType: mysqlEnum("delivery_type", deliveryTypeValues).notNull(),

    // Shipping data as JSON snapshot
    shippingData: json("shipping_data").$type<ShippingData | null>(),

    // Billing data as JSON snapshot
    billingData: json("billing_data").$type<BillingData | null>(),

    // Pickup fields (only when deliveryType = "pickup")
    pickupLocationData: json("pickup_location_data").$type<PickupLocationData | null>(),
    pickupDate: varchar("pickup_date", { length: 20 }), // YYYY-MM-DD format
    pickupTime: varchar("pickup_time", { length: 50 }), // e.g., "10:00-12:00"

    // Common fields /only customer, not editable by admin
    observations: text("observations"),
    internalNotes: json("internal_notes").$type<InternalNote[] | null>(), //only admin

    // Financial totals (stored for historical accuracy)
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    taxes: decimal("taxes", { precision: 10, scale: 2 }).notNull().default("0.00"),
    discounts: decimal("discounts", { precision: 10, scale: 2 }).notNull().default("0.00"),
    shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),

    // last modified tracking (for quick info)
    lastModifiedBy: varchar("last_modified_by", { length: 24 }).references(() => users.id),
    lastModifiedAt: timestamp("last_modified_at"),

    // Cancellation tracking
    cancelReason: text("cancel_reason"),
    cancelledBy: varchar("cancelled_by", { length: 24 }).references(() => users.id),
    cancelledAt: timestamp("cancelled_at"),

    // revision count (útil for badge "Revisado X veces")
    revisionCount: int("revision_count").default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow().defaultNow().notNull()
  },
  (table) => [
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_code_idx").on(table.orderCode),
    index("orders_created_idx").on(table.createdAt),
    index("orders_user_status_idx").on(table.userId, table.status)
  ]
)

export type Order = typeof orders.$inferSelect
export type OrderInsert = typeof orders.$inferInsert

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

export interface PickupLocationData {
  id: string
  name: string
  address: string
  phone?: string
  openingHours?: string
}

// Type for shipping data JSON
export interface ShippingData {
  fullName: string
  addressLine1: string // Street
  addressLine2?: string // Number, floor, apartment
  city: string
  province: string
  postalCode: string
  phone: string
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
  cuit?: string
  ivaCategory?: string
}

export const orderHistory = mysqlTable(
  "order_history",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),

    orderId: varchar("order_id", { length: 24 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    userId: varchar("user_id", { length: 24 }).references(() => users.id), // null = sistema

    eventType: mysqlEnum("event_type", [
      "order_created", // Cliente hizo checkout
      "admin_adjustment", // Admin modificó items/precios
      "customer_add_on",
      "status_change", // Cambio de estado (pending_review → pending_payment, etc.)
      "shipping_changed", // Cambió dirección, tipo o costo de envío
      "payment_marked", // Admin marcó como pagado
      "payment_proof_uploaded", // Cliente subió comprobante
      "note_added", // Admin o cliente agregó nota
      // otros
      "cancelled"
    ]).notNull(),

    // TODO: rever summary unnecesary...
    summary: varchar("summary", { length: 500 }), // "Ajustó cantidades, eliminó Plato x2"

    metadata: json("metadata")
      .$type<{
        // more simple
        itemsChanged?: { productName: string; change: string }[]
        totalsBefore?: { subtotal: string; shipping: string; total: string }
        totalsAfter?: { subtotal: string; shipping: string; total: string }
        // Nota libre
        note?: string
        generalChanges?: string[]
      }>()
      .default({}),

    totalsSnapshot: json("totals_snapshot").$type<{
      subtotal: string
      shipping: string
      total: string
    }>(),

    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    index("history_order_idx").on(table.orderId),
    index("history_event_idx").on(table.eventType),
    index("history_created_idx").on(table.createdAt)
  ]
)
