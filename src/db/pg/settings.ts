import { jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core"

export const settings = pgTable("settings", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: jsonb("value"),
  category: varchar("category", { length: 50 }).notNull().default("general"),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .$onUpdate(() => new Date())
    .defaultNow()
    .notNull()
})

export type Setting = typeof settings.$inferSelect
export type SettingInsert = typeof settings.$inferInsert
