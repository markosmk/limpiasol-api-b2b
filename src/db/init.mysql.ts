import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema"

const connection = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

export const dbMySQL = drizzle(connection, { schema, mode: "default" })
export type DatabaseMySQL = MySql2Database<typeof schema>
