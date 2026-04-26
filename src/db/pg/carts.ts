import { createId } from "@paralleldrive/cuid2"
import { relations } from "drizzle-orm"
import {
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core"
import { productVariants } from "./products"
import { users } from "./users"

export const cartStatusEnum = pgEnum("cart_status", ["active", "abandoned", "converted"])

export const carts = pgTable(
  "carts",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: varchar("user_id", { length: 24 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: cartStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("carts_user_idx").on(table.userId),
    index("carts_status_idx").on(table.status),
    index("carts_created_idx").on(table.createdAt),
    index("carts_user_status_idx").on(table.userId, table.status)
  ]
)

export const cartItems = pgTable(
  "cart_items",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    cartId: varchar("cart_id", { length: 24 })
      .references(() => carts.id, { onDelete: "cascade" })
      .notNull(),
    variantId: varchar("variant_id", { length: 24 })
      .references(() => productVariants.id, {
        onDelete: "cascade"
      })
      .notNull(),
    quantity: integer("quantity").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("cart_items_cart_idx").on(table.cartId),
    index("cart_items_variant_idx").on(table.variantId),
    uniqueIndex("cart_items_unq").on(table.cartId, table.variantId)
  ]
)

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems)
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id]
  }),
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id]
  })
}))
