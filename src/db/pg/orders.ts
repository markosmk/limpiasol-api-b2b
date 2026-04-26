import { createId } from "@paralleldrive/cuid2"
import {
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core"
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

export const orderStatusEnum = pgEnum("order_status", orderStatusValues)
export const deliveryTypeEnum = pgEnum("delivery_type", deliveryTypeValues)
export const timelineEventEnum = pgEnum("timeline_event_type", timelineEventValues)

export const orders = pgTable(
  "orders",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    orderNumber: serial("order_number"),
    orderCode: char("order_code", { length: 8 }).notNull().unique(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("pending"),
    deliveryType: deliveryTypeEnum("delivery_type").notNull(),

    shippingData: jsonb("shipping_data").$type<ShippingData | null>(),
    billingData: jsonb("billing_data").$type<BillingData | null>(),
    pickupLocationData: jsonb("pickup_location_data").$type<PickupLocationData | null>(),

    observations: text("observations"),
    internalNotes: jsonb("internal_notes").$type<InternalNote[] | null>(),

    subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
    discounts: numeric("discounts", { precision: 10, scale: 2 }).notNull().default("0"),
    shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    taxes: numeric("taxes", { precision: 10, scale: 2 }).notNull().default("0"),
    manualAdjustment: numeric("manual_adjustment", { precision: 10, scale: 2 })
      .default("0")
      .notNull(),
    total: numeric("total", { precision: 10, scale: 2 }).notNull(),

    cancelReason: text("cancel_reason"),
    cancelledBy: varchar("cancelled_by", { length: 24 }),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => new Date())
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date" })
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

export const orderItems = pgTable(
  "order_items",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),

    orderId: varchar("order_id", { length: 24 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),

    productId: varchar("product_id", { length: 24 })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),

    variantId: varchar("variant_id", { length: 24 })
      .notNull()
      .references(() => productVariants.id, {
        onDelete: "restrict"
      }),

    productName: varchar("product_name", { length: 255 }).notNull(),
    productSku: varchar("product_sku", { length: 100 }),
    productImage: varchar("product_image", { length: 512 }),
    variantName: varchar("variant_name", { length: 100 }),

    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
    tierType: varchar("tier_type", { length: 20 }),

    quantity: integer("quantity").notNull(),
    volumeDiscountApplied: numeric("volume_discount_applied", { precision: 12, scale: 2 }).default(
      "0"
    ),
    lineSubtotal: numeric("line_subtotal", { precision: 12, scale: 2 }).notNull(),

    purchaseRules: jsonb("purchase_rules").$type<PurchaseRule>(),

    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { mode: "date" })
  },
  (table) => [
    index("order_items_order_idx").on(table.orderId),
    index("order_items_product_idx").on(table.productId),
    index("order_items_variant_idx").on(table.variantId),
    index("order_items_product_created_idx").on(table.productId, table.createdAt)
  ]
)

export type OrderItem = typeof orderItems.$inferSelect
export type OrderItemInsert = typeof orderItems.$inferInsert

export const orderTimeline = pgTable(
  "order_timeline",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    orderId: varchar("order_id", { length: 24 })
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    eventType: timelineEventEnum("event_type").notNull(),

    fromStatus: varchar("from_status", { length: 20 }),
    toStatus: varchar("to_status", { length: 20 }),

    changedBy: varchar("changed_by", { length: 24 }),

    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow()
  },
  (table) => [
    index("timeline_order_idx").on(table.orderId),
    index("timeline_event_type_idx").on(table.eventType),
    index("timeline_created_idx").on(table.createdAt),
    index("timeline_order_created_idx").on(table.orderId, table.createdAt)
  ]
)

export type OrderTimeline = typeof orderTimeline.$inferSelect
export type OrderTimelineInsert = typeof orderTimeline.$inferInsert
