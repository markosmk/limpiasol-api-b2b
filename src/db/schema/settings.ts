import { json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core"

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: json("value"),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  updatedAt: timestamp("updated_at").onUpdateNow().defaultNow().notNull()
})

export type Setting = typeof settings.$inferSelect
export type SettingInsert = typeof settings.$inferInsert
