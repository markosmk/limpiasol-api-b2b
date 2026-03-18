import { relations } from "drizzle-orm"
import { orderItems, orders, ordersTimeline } from "./orders"
import { products, productVariants } from "./products"
import { users } from "./users"

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id]
  }),
  items: many(orderItems),
  timeline: many(ordersTimeline)
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id]
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id]
  })
}))

export const ordersTimelineRelations = relations(ordersTimeline, ({ one }) => ({
  order: one(orders, {
    fields: [ordersTimeline.orderId],
    references: [orders.id]
  })
}))
