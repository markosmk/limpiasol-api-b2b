import { createId } from "@paralleldrive/cuid2"
import { index, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core"
import { users } from "./users"

export const verificationTypeEnum = pgEnum("verification_type", [
  "email_verification",
  "password_reset"
])

export const session = pgTable(
  "session",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { precision: 3, mode: "date" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent")
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: varchar("id", { length: 255 })
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: verificationTypeEnum("type").notNull(),
    expiresAt: timestamp("expires_at", { precision: 3, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { precision: 3, mode: "date" }).defaultNow().notNull()
  },
  (table) => [
    index("verification_userId_idx").on(table.userId),
    index("verification_type_idx").on(table.type)
  ]
)
