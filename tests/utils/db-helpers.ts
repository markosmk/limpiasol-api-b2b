/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { eq } from "drizzle-orm"
import type { MySqlTableWithColumns } from "drizzle-orm/mysql-core"

import { db } from "@/db"

export async function insertAndGet<T extends MySqlTableWithColumns<any>>(
  table: T,
  values: T["$inferInsert"]
): Promise<T["$inferSelect"]> {
  // const tableName = table[Symbol.for("drizzle:Name")] as keyof typeof db.query
  const [data] = (await db.insert(table).values(values).$returningId()) as any
  if (!data?.id) throw new Error(`Failed to insert into ${table?.name}`)

  const result = await db.select().from(table).where(eq(table.id, data.id))
  if (!result) throw new Error(`Failed to fetch inserted record from ${table?.name}`)
  return result
}

export async function cleanTable(table: MySqlTableWithColumns<any>) {
  const tableName = table?.name as string
  await db.execute(`TRUNCATE TABLE \`${tableName}\``)
}

export type CleanupFn = () => Promise<void>

export async function insertWithCleanup<T extends MySqlTableWithColumns<any>>(
  table: T,
  values: T["$inferInsert"]
): Promise<{ data: T["$inferSelect"]; cleanup: CleanupFn }> {
  const [data] = (await db.insert(table).values(values).$returningId()) as any
  if (!data?.id) throw new Error("Failed to insert")

  const result = await db.select().from(table).where(eq(table.id, data.id))
  if (!result) throw new Error("Failed to fetch inserted record")

  const cleanup = async () => {
    await db.delete(table).where(eq(table.id, data.id))
  }

  return { data: result[0] as T["$inferSelect"], cleanup }
}
