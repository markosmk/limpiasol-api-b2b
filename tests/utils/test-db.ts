// import { drizzle } from "drizzle-orm/mysql2"
// import mysql from "mysql2/promise"

// for postgres
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import type { Database } from "@/db"

import * as schema from "@/db/pg"

// import * as schema from "@/db/schema"

// let connection: mysql.Connection
let connection: NodePgDatabase<typeof schema>
let db: Database

async function setupTestDB() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required")

  // connection = await mysql.createConnection(url)
  // db = drizzle(connection, { schema, mode: "default" })
  // return db
  const pool = new Pool({ connectionString: url })
  connection = drizzle({ client: pool, schema })
  db = connection
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

  for (const table of tablesToTruncate) {
    await connection.execute(`TRUNCATE TABLE ${table} CASCADE`)
  }
  // await connection.end()
}

// not use on routes tests because the tests use fastify cookies
async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await db.execute("BEGIN")
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
