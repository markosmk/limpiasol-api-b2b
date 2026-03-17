import { drizzle } from "drizzle-orm/mysql2"
import { migrate } from "drizzle-orm/mysql2/migrator"
import mysql from "mysql2/promise"

async function main() {
  console.log("Starting migration...")
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL || "mysql://root:root@localhost:3306/ecommerce_limpiasol"
  })

  const db = drizzle(pool)

  await migrate(db, { migrationsFolder: "./drizzle/migrations" })

  console.log("Migrations applied successfully!")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
