import { createId } from "@paralleldrive/cuid2"
import { index, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core"
import { users } from "./users"

export const session = mysqlTable(
  "session",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent")
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const verificationTokens = mysqlTable(
  "verification_tokens",
  {
    id: varchar("id", { length: 255 })
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["email_verification", "password_reset"]).notNull(),
    expiresAt: timestamp("expires_at", { fsp: 3 }).notNull(),
    createdAt: timestamp("created_at", { fsp: 3 }).defaultNow().notNull()
  },
  (table) => [
    index("verification_userId_idx").on(table.userId),
    index("verification_type_idx").on(table.type)
  ]
)
