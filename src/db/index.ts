import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10
})

export const db = drizzle({ client: pool, schema })
export type Database = NodePgDatabase<typeof schema>
