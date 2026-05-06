/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { hashPassword } from "../src/utils/auth/hash"
import {
  mockCategories,
  mockModules,
  mockOrderItems,
  mockOrders,
  mockPriceTiers,
  mockProductCategories,
  mockProducts,
  mockUsers,
  mockVariants
} from "./mocks"

import {
  categories,
  orderItems,
  orders,
  priceTiers,
  productCategories,
  products,
  productVariants,
  settings,
  users
} from "@/db/pg"

async function main() {
  console.log("🌱 Starting seeding...")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const connection = await pool.connect()

  const db = drizzle(connection)

  try {
    // 1. INSERCIÓN DE USUARIOS
    console.log("⏳ Seeding users...")
    const passwordHash = await hashPassword("password123")
    for (const mockUser of mockUsers) {
      await db
        .insert(users)
        .values({ ...mockUser, passwordHash })
        .onConflictDoNothing()
    }

    // 2. INSERCIÓN DE CATEGORÍAS
    console.log("⏳ Seeding categories...")
    for (const cat of mockCategories) {
      await db.insert(categories).values(cat).onConflictDoNothing()
    }

    // 3. INSERCIÓN DE PRODUCTOS
    console.log("⏳ Seeding products...")
    for (const prod of mockProducts) {
      await db.insert(products).values(prod).onConflictDoNothing()
    }

    // 4. INSERCIÓN DE VARIANTES
    console.log("⏳ Seeding product variants...")
    for (const variant of mockVariants) {
      await db.insert(productVariants).values(variant).onConflictDoNothing()
    }

    // 5. INSERCIÓN DE CATEGORÍAS DE PRODUCTOS
    console.log("⏳ Seeding product categories...")
    for (const pc of mockProductCategories) {
      await db.insert(productCategories).values(pc).onConflictDoNothing()
    }

    // 6. INSERCIÓN DE TIERS DE PRECIOS
    console.log("⏳ Seeding price tiers...")
    for (const tier of mockPriceTiers) {
      await db.insert(priceTiers).values(tier).onConflictDoNothing()
    }

    // 7. INSERCIÓN DE ÓRDENES Y SUS ITEMS
    console.log("⏳ Seeding orders...")
    for (const order of mockOrders) {
      await db.insert(orders).values(order).onConflictDoNothing()
    }
    console.log("⏳ Seeding order items...")
    for (const item of mockOrderItems) {
      await db.insert(orderItems).values(item).onConflictDoNothing()
    }

    // 8. INSERCIÓN DE CONFIGURACIONES DE MÓDULOS (En tabla settings)
    console.log("⏳ Seeding modules config...")
    for (const mod of mockModules) {
      const key = `modules:${mod.name}`
      const value = {
        enabled: mod.enabled,
        config: mod.config,
        updatedAt: new Date().toISOString()
      }

      await db
        .insert(settings)
        .values({
          key,
          category: "modules",
          value
        })
        .onConflictDoUpdate({
          target: [settings.key],
          set: {
            value,
            updatedAt: new Date()
          }
        })
    }

    console.log("✅ Seeding finished successfully!")
  } catch (error) {
    console.error("❌ Seeding failed:", error)
  } finally {
    connection.release()
    await pool.end()
    console.log("🏁 Database connection closed.")
    process.exit(0)
  }
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err)
  process.exit(1)
})
