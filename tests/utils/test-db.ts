import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import type { Database } from "@/db"

import * as schema from "@/db/schema"

let connection: mysql.Connection
let db: Database

async function setupTestDB() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL or TEST_DATABASE_URL is required")

  connection = await mysql.createConnection(url)
  db = drizzle(connection, { schema, mode: "default" })
  return db
}

/**
 * TODO: add domains, orders, users, collections, tags, in correct order to clean up
 *
 * config vitest: `fileParallelism: false`
 */
async function teardownTestDB() {
  if (!connection) return

  const tablesToTruncate = [
    "settings",
    "session",
    "users",
    "order_timeline",
    "order_items",
    "orders",
    "price_tiers",
    "product_variants",
    "products"
  ]

  await connection.execute("SET FOREIGN_KEY_CHECKS = 0")
  for (const table of tablesToTruncate) {
    await connection.execute(`TRUNCATE TABLE ${table}`)
  }
  await connection.execute("SET FOREIGN_KEY_CHECKS = 1")
  await connection.end()
}

// not use on routes tests because the tests use fastify cookies
async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await db.execute("START TRANSACTION")
  try {
    const result = await fn()
    await db.execute("ROLLBACK")
    return result
  } catch (error) {
    await db.execute("ROLLBACK")
    throw error
  }
}

export { db, setupTestDB, teardownTestDB, withTransaction }
