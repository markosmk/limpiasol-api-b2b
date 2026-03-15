import { createId } from "@paralleldrive/cuid2"
import {
  boolean,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core"

// User status enum values
export const userStatusValues = [
  "pending_approval", // User verified email, waiting for admin approval
  "active", // User can login and use the platform
  "rejected", // Admin rejected the registration
  "suspended" // User was suspended by admin
] as const

// User role enum values (better-auth handle by default user and admin)
export const userRoleValues = ["user", "reseller", "admin"] as const

export const adminLevelValues = [
  "super",
  "moderator",
  "admin",
  "sales",
  "support",
  "inventory"
] as const

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()), // { length: 36 }).primaryKey(),

    // Auth
    email: varchar("email", { length: 100 }).notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    // Profile
    name: varchar("name", { length: 100 }),
    phone: varchar("phone", { length: 50 }),
    profileInfo: json("profile_info").$type<UserProfileInfo>(),
    image: text("image"),

    // data fiscal
    cuit: varchar("cuit", { length: 13 }), // remove unique, unicity handled internally
    ivaCategory: varchar("iva_category", { length: 50 }),

    // Role & Status
    role: mysqlEnum("role", userRoleValues).notNull().default("user"),
    adminLevel: mysqlEnum("ac_level", adminLevelValues),
    status: mysqlEnum("status", userStatusValues).notNull().default("pending_approval"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { fsp: 3 }),

    // Timestamps
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull() //
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_status_idx").on(table.status),
    index("users_cuit_idx").on(table.cuit)
  ]
)

export type User = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert

// Type for profile info JSON
export interface UserProfileInfo {
  companyName?: string
  tradeName?: string
  notes?: string
}
