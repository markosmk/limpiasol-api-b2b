import { createId } from "@paralleldrive/cuid2"
import { relations } from "drizzle-orm"
import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core"
import { products, productVariants } from "./products"
import { users } from "./users"

export const carts = mysqlTable(
  "carts",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: varchar("user_id", { length: 24 })
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: mysqlEnum("status", ["active", "abandoned", "converted"]).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    index("carts_user_idx").on(table.userId),
    index("carts_status_idx").on(table.status),
    index("carts_created_idx").on(table.createdAt),
    index("carts_user_status_idx").on(table.userId, table.status)
  ]
)

export const cartItems = mysqlTable(
  "cart_items",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    cartId: varchar("cart_id", { length: 24 })
      .references(() => carts.id, { onDelete: "cascade" })
      .notNull(),
    productId: varchar("product_id", { length: 24 })
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    variantId: varchar("variant_id", { length: 24 }).references(() => productVariants.id, {
      onDelete: "cascade"
    }),
    quantity: int("quantity").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull()
  },
  (table) => [
    index("cart_items_cart_idx").on(table.cartId),
    index("cart_items_product_idx").on(table.productId),
    index("cart_items_variant_idx").on(table.variantId),
    // unique index to avoid duplicates of the same product/variant in the cart
    uniqueIndex("cart_items_unq").on(table.cartId, table.productId, table.variantId)
  ]
)

// for ej: query.carts.findFirst({ with: { items: true } })
export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems)
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id]
  })
  // product: one(products, {
  //   fields: [cartItems.productId],
  //   references: [products.id]
  // }),
  // variant: one(productVariants, {
  //   fields: [cartItems.variantId],
  //   references: [productVariants.id]
  // })
}))
