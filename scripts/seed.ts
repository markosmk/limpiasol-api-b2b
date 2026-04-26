/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import { eq } from "drizzle-orm"

// for mysql
// import { drizzle } from "drizzle-orm/mysql2"
// import mysql from "mysql2/promise"

// for postgres
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { hashPassword } from "../src/utils/auth/hash"
import { mockProducts, mockTiers, mockUsers } from "./mocks"

import { priceTiers, products, users } from "@/db/pg"

async function main() {
  console.log("🌱 Starting seeding...")

  // for mysql
  // const connection = await mysql.createConnection({
  //   uri: process.env.DATABASE_URL
  // })

  // for postgres
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const connection = await pool.connect()

  const db = drizzle(connection)

  try {
    // ────────────────────────────────────────────────────────
    // 1. INSERCIÓN DE USUARIOS
    // ────────────────────────────────────────────────────────
    console.log("⏳ Seeding users...")
    const passwordHash = await hashPassword("password123")

    for (const mockUser of mockUsers) {
      try {
        await db.insert(users).values({ ...mockUser, passwordHash })
      } catch (err) {
        if ((err as any).code !== "ER_DUP_ENTRY") throw err
      }
    }

    // ────────────────────────────────────────────────────────
    // 2. INSERCIÓN DE PRODUCTOS Y PRECIOS
    // ────────────────────────────────────────────────────────
    console.log("⏳ Seeding products and tiers...")
    for (const mockProduct of mockProducts) {
      try {
        // Insertamos el producto y recuperamos su ID generado
        await db.insert(products).values({ ...mockProduct, slug: `123${Date.now()}` })

        // Buscamos el ID del producto recién creado (o que ya existía)
        const [dbProduct] = await db
          .select()
          .from(products)
          .where(eq(products.code, mockProduct.code!))

        if (dbProduct) {
          // Le inyectamos los precios por volumen (Tiers) a este producto específico
          for (const tier of mockTiers) {
            await db
              .insert(priceTiers)
              .values({
                productId: dbProduct.id,
                ...tier
              })
              .catch((e) => {
                if (e.code !== "ER_DUP_ENTRY") throw e
              })
          }
        }
      } catch (err) {
        if ((err as any).code !== "ER_DUP_ENTRY") throw err
      }
    }

    // ────────────────────────────────────────────────────────
    // 3. INSERCIÓN DE ÓRDENES B2B (Relacionando todo)
    // ────────────────────────────────────────────────────────
    console.log("⏳ Seeding reseller orders...")

    // Recuperamos al usuario Reseller para asignarle las compras
    const [_reseller] = await db
      .select()
      .from(users)
      .where(eq(users.email, "reseller@business.com"))

    // if (reseller) {
    //   const newOrder: OrderInsert = {
    //     userId: reseller.id,
    //     orderCode: "ORD-001",
    //     status: "pending_payment", // Estado típico de B2B
    //     total: "50000.00",
    //     subtotal: "50000.00",
    //     deliveryType: "pickup",
    //     pickupLocationData: {
    //       locationId: "123",
    //       locationName: "Pickup Location",
    //       address: "123 Main St",
    //       scheduledDate: "2026-11-11",
    //       scheduledTime: "12:00"
    //     }
    //   }

    //   await db
    //     .insert(orders)
    //     .values(newOrder)
    //     .catch((e) => {
    //       if (e.code !== "ER_DUP_ENTRY") throw e
    //     })

    //   // 1. Recuperamos la orden para obtener su ID real
    //   const [dbOrder] = await db.select().from(orders).where(eq(orders.orderCode, "ORD-TEST-001"))

    //   // 2. Recuperamos los productos para obtener sus IDs reales
    //   const dbProducts = await db.select().from(products)

    //   if (dbOrder && dbProducts.length >= 2) {
    //     console.log("⏳ Seeding order items...")

    //     // Sumamos 50,000 exactos para que la DB tenga sentido
    //     // 10 Lavandinas x 4000 = 40,000
    //     // 2 Detergentes x 5000 = 10,000

    //     const itemsToInsert: OrderItemInsert[] = [
    //       {
    //         orderId: dbOrder.id,
    //         productId: dbProducts[0].id,
    //         variantId: null,
    //         quantity: 10,
    //         unitPrice: "4000.00",
    //         lineSubtotal: "40000.00",
    //         productName: dbProducts[0].name,
    //         productSku: null,
    //       },
    //       {
    //         orderId: dbOrder.id,
    //         productId: dbProducts[1].id,
    //         variantId: null,
    //         quantity: 2,
    //         unitPrice: "5000.00",
    //         lineSubtotal: "10000.00",
    //         productName: dbProducts[1].name,
    //         productSku: null
    //       }
    //     ]

    //     for (const item of itemsToInsert) {
    //       await db
    //         .insert(orderItems)
    //         .values(item)
    //         .catch((e) => {
    //           if (e.code !== "ER_DUP_ENTRY") throw e
    //         })
    //     }
    //   }
    // }
    console.log("✅ Seeding finished successfully!")
  } catch (error) {
    console.error("❌ Seeding failed:", error)
  } finally {
    // close connection postgresql
    await pool.end()
    // await connection.end() // mysql
    console.log("🏁 Seeding finished!")
    process.exit(0)
  }
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err)
  process.exit(1)
})
