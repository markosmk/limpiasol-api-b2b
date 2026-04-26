/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { eq } from "drizzle-orm"
import type { MySqlTableWithColumns } from "drizzle-orm/mysql-core"
import type { PurchaseRule } from "@/db/pg/products.types"

import { db } from "@/db"
import { priceTiers, products, productVariants } from "@/db/pg/products"

export async function insertAndGet<T extends MySqlTableWithColumns<any>>(
  table: T,
  values: T["$inferInsert"]
): Promise<T["$inferSelect"]> {
  const [data] = (await db.insert(table).values(values).returning()) as any
  if (!data?.id) throw new Error(`Failed to insert into ${table?.name}`)
  return data
}

export async function cleanTable(table: MySqlTableWithColumns<any>) {
  const tableName = table?.name as string
  await db.execute(`TRUNCATE TABLE \`${tableName}\``)
}

export type CleanupFn = () => Promise<void>

export async function insertWithCleanup<T extends MySqlTableWithColumns<any>>(
  table: T,
  values: T["$inferInsert"]
): Promise<{ data: T["$inferSelect"]; cleanup: CleanupFn }> {
  const [data] = (await db.insert(table).values(values).returning()) as any
  if (!data?.id) throw new Error("Failed to insert")

  const cleanup = async () => {
    await db.delete(table).where(eq(table.id, data.id))
  }

  return { data, cleanup }
}

export async function createTestProductWithVariant(data: {
  name: string
  slug: string
  productRules?: PurchaseRule
  variantRules?: PurchaseRule
  price: string
  tierType: string
}) {
  const [{ id: productId }] = await db
    .insert(products)
    .values({
      name: data.name,
      slug: data.slug,
      status: "published",
      purchaseRules: data.productRules
    })
    .returning({ id: products.id })

  const [{ id: variantId }] = await db
    .insert(productVariants)
    .values({
      productId,
      sku: `${data.slug.toUpperCase()}-DEF`,
      name: "Default",
      options: { Default: "Default" },
      purchaseRules: data.variantRules
    })
    .returning({ id: productVariants.id })

  await db.insert(priceTiers).values({
    productId,
    variantId,
    tierType: data.tierType,
    price: data.price
  })

  return { productId, variantId }
}
