import mysql from "mysql2/promise"

async function main() {
  const url = process.env.DATABASE_URL

  if (!url) {
    console.error("DATABASE_URL is not defined.")
    process.exit(1)
  }

  console.log("Starting database reset...")

  const connection = await mysql.createConnection(url)

  try {
    // Disable foreign key checks to allow dropping tables in any order
    await connection.query("SET FOREIGN_KEY_CHECKS = 0")

    // Get all tablenames
    const [rows] = await connection.query("SHOW TABLES")
    const tableNames = rows.map((row) => Object.values(row)[0])

    if (tableNames.length > 0) {
      console.log(`Dropping ${tableNames.length} tables: ${tableNames.join(", ")}`)
      for (const name of tableNames) {
        await connection.query(`DROP TABLE IF EXISTS \`${name}\``)
      }
      console.log("All tables dropped successfully.")
    } else {
      console.log("No tables found to drop.")
    }

    // Drop drizzle migrations table if it exists as well
    await connection.query("DROP TABLE IF EXISTS __drizzle_migrations")

    // Enable foreign key checks back
    await connection.query("SET FOREIGN_KEY_CHECKS = 1")
    console.log("Database successfully reset.")
  } catch (err) {
    console.error("Error resetting database:", err)
    process.exit(1)
  } finally {
    await connection.end()
  }

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
