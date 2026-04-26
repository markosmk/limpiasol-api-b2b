import { createId } from "@paralleldrive/cuid2"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core"

export const userStatusValues = ["pending_approval", "active", "rejected", "suspended"] as const

export const userRoleValues = ["user", "reseller", "admin"] as const

export const adminLevelValues = [
  "super",
  "moderator",
  "admin",
  "sales",
  "support",
  "inventory"
] as const

export const userStatusEnum = pgEnum("user_status", userStatusValues)
export const userRoleEnum = pgEnum("user_role", userRoleValues)
export const adminLevelEnum = pgEnum("admin_level", adminLevelValues)

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),

    email: varchar("email", { length: 100 }).notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),

    name: varchar("name", { length: 100 }),
    phone: varchar("phone", { length: 50 }),
    profileInfo: jsonb("profile_info").$type<UserProfileInfo>(),
    image: text("image"),

    cuit: varchar("cuit", { length: 13 }),
    ivaCategory: varchar("iva_category", { length: 50 }),

    role: userRoleEnum("role").notNull().default("user"),
    adminLevel: adminLevelEnum("ac_level"),
    status: userStatusEnum("status").notNull().default("pending_approval"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { precision: 3, mode: "date" }),

    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull()
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_status_idx").on(table.status),
    index("users_cuit_idx").on(table.cuit)
  ]
)

export type User = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert

export interface UserProfileInfo {
  companyName?: string
  tradeName?: string
  notes?: string
}
