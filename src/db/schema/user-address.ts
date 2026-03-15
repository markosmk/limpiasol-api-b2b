import { createId } from "@paralleldrive/cuid2"
import { boolean, index, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core"
import { users } from "./users"

export const userAddresses = mysqlTable(
  "user_addresses",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Address details
    label: varchar("label", { length: 50 }),
    fullName: varchar("full_name", { length: 100 }),
    addressLine1: varchar("address_line_1", { length: 256 }).notNull(), // Street
    addressLine2: varchar("address_line_2", { length: 100 }), // Number, floor, apartment
    city: varchar("city", { length: 100 }).notNull(),
    province: varchar("province", { length: 100 }).notNull(),
    postalCode: varchar("postal_code", { length: 20 }).notNull(),
    phone: varchar("phone", { length: 50 }),

    // Default flags
    isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
    isDefaultBilling: boolean("is_default_billing").notNull().default(false),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow().defaultNow().notNull()
  },
  (table) => [
    index("user_addresses_user_idx").on(table.userId),
    index("user_addresses_default_shipping_idx").on(table.userId, table.isDefaultShipping),
    index("user_addresses_default_billing_idx").on(table.userId, table.isDefaultBilling)
  ]
)

export type UserAddress = typeof userAddresses.$inferSelect
export type UserAddressInsert = typeof userAddresses.$inferInsert

// Type for address data used in forms and snapshots
export interface AddressData {
  label?: string
  fullName?: string
  addressLine1: string
  addressLine2?: string
  city: string
  province: string
  postalCode: string
  phone?: string
}
