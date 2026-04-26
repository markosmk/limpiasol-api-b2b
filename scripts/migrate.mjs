import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

async function main() {
  console.log("Starting PostgreSQL migration...")

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1 // Solo necesitamos 1 conexión para migrar
  })

  const db = drizzle({ client: pool })

  await migrate(db, { migrationsFolder: "./drizzle/migrations" })

  console.log("Migrations applied successfully!")
  await pool.end()
  process.exit(0)
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
