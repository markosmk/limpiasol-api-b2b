import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import { type UserInsert, users } from "../src/db/schema/users"
import { hashPassword } from "../src/utils/auth/hash"

async function main() {
  console.log("🌱 Starting seeding...")

  const connection = await mysql.createConnection({
    uri: process.env.DATABASE_URL
  })

  const db = drizzle(connection)

  const passwordHash = await hashPassword("password123")

  const seedUsers: UserInsert[] = [
    {
      email: "admin@business.com",
      passwordHash,
      role: "admin",
      status: "active",
      emailVerified: true,
      name: "Admin User"
    },
    {
      email: "reseller@business.com",
      passwordHash,
      role: "reseller",
      status: "active",
      emailVerified: true,
      name: "Reseller User"
    },
    {
      email: "staff@business.com",
      passwordHash,
      role: "user",
      status: "active",
      emailVerified: true,
      name: "Staff User"
    }
  ]

  for (const user of seedUsers) {
    try {
      await db.insert(users).values(user)
      console.log(`✅ User created: ${user.email}`)
    } catch (err) {
      if ((err as Error & { code: string }).code === "ER_DUP_ENTRY") {
        console.log(`⏩ User ${user.email} already exists, skipping.`)
      } else {
        console.error(`❌ Error creating user ${user.email}:`, (err as Error).message)
      }
    }
  }

  await connection.end()
  console.log("🏁 Seeding finished!")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err)
  process.exit(1)
})
