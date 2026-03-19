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
import {
  type BillingData,
  deliveryTypeValues,
  type InternalNote,
  orderStatusValues,
  type PickupLocationData,
  type ShippingData,
  timelineEventValues
} from "./orders.types"
import { products, productVariants } from "./products"
import { users } from "./users"
import type { PurchaseRule } from "./products.types"

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

    // JSON snapshot
    shippingData: json("shipping_data").$type<ShippingData | null>(),
    billingData: json("billing_data").$type<BillingData | null>(),
    // Pickup fields (only when deliveryType = "pickup")
    pickupLocationData: json("pickup_location_data").$type<PickupLocationData | null>(),

    // Common fields /only customer, not editable by admin
    observations: text("observations"),
    internalNotes: json("internal_notes").$type<InternalNote[] | null>(), // only admin

    // totals
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    discounts: decimal("discounts", { precision: 10, scale: 2 }).notNull().default("0"),
    shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    taxes: decimal("taxes", { precision: 10, scale: 2 }).notNull().default("0"),
    // descuentos/recargos manuales fuera del cálculo automático
    manualAdjustment: decimal("manual_adjustment", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    // ej: subtotal - discounts + shippingCost + taxes + manualAdjustment
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),

    // cancellation tracking (campos nullable, solo se llenan si status = "cancelled")
    cancelReason: text("cancel_reason"),
    // by: ej: userId o 'admin' o 'system'
    cancelledBy: varchar("cancelled_by", { length: 24 }), //.references(() => users.id),
    cancelledAt: timestamp("cancelled_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow().defaultNow().notNull(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => [
    index("orders_user_idx").on(table.userId),
    index("orders_status_idx").on(table.status),
    index("orders_code_idx").on(table.orderCode),
    index("orders_created_idx").on(table.createdAt),
    index("orders_user_status_idx").on(table.userId, table.status),
    index("orders_delivery_status_idx").on(table.deliveryType, table.status)
  ]
)

export type Order = typeof orders.$inferSelect
export type OrderInsert = typeof orders.$inferInsert

export const orderItems = mysqlTable(
  "order_items",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),

    orderId: varchar("order_id", { length: 24 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    // referencia al producto original (para trazabilidad)
    productId: varchar("product_id", { length: 24 })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),

    variantId: varchar("variant_id", { length: 24 }).references(() => productVariants.id, {
      onDelete: "restrict"
    }),

    // snapshot
    productName: varchar("product_name", { length: 255 }).notNull(),
    productSku: varchar("product_sku", { length: 100 }).notNull(),
    productImage: varchar("product_image", { length: 512 }),
    variantName: varchar("variant_name", { length: 100 }), // Ej: "Rojo / XL"

    // precio unitario CONGELADO al momento de la compra
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: decimal("compare_at_price", { precision: 12, scale: 2 }), // Precio de referencia
    tierType: varchar("tier_type", { length: 20 }), // "retail" | "wholesale" | etc. (qué tier se aplicó)

    // cantidad y cálculos de línea
    quantity: int("quantity").notNull(),
    volumeDiscountApplied: decimal("volume_discount_applied", { precision: 12, scale: 2 }).default(
      "0"
    ),
    lineSubtotal: decimal("line_subtotal", { precision: 12, scale: 2 }).notNull(), // unitPrice * qty - volumeDiscount

    // reglas de compra aplicadas (snapshot de purchaseRules del producto)
    purchaseRules: json("purchase_rules").$type<PurchaseRule>(),

    // metadata extra si se necesita (ej: personalizaciones, notas del item)
    metadata: json("metadata"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
    deletedAt: timestamp("deleted_at")
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_product_idx").on(table.productId),
    index("order_items_variant_idx").on(table.variantId),
    // indice compuesto para queries de reporting: "items vendidos por producto"
    index("order_items_product_created_idx").on(table.productId, table.createdAt)
  ]
)

export type OrderItem = typeof orderItems.$inferSelect
export type OrderItemInsert = typeof orderItems.$inferInsert

export const orderTimeline = mysqlTable(
  "order_timeline",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    orderId: varchar("order_id", { length: 24 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventType: mysqlEnum("event_type", timelineEventValues).notNull(),

    // for status change events: context of the change
    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }),

    changedBy: varchar("changed_by", { length: 24 }), // userId, 'admin', 'system'
    // Metadata flexible según el evento
    // Ej:
    // - status_changed: { reason: "stock_agotado", adminNote: "Cliente pidió cambio de fecha" }
    // - items_adjusted: { addedItems: [...], removedItems: [...], priceDiff: 15.50 }
    // - pickup_scheduled: { oldDate: "2024-01-15", newDate: "2024-01-18" }
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => [
    index("timeline_order_idx").on(table.orderId),
    index("timeline_event_type_idx").on(table.eventType),
    index("timeline_created_idx").on(table.createdAt),
    // index para queries de "historial de un pedido ordenado por fecha"
    index("timeline_order_created_idx").on(table.orderId, table.createdAt)
  ]
)
