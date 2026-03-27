import { and, eq, isNull } from "drizzle-orm"

import { type Database, db } from "@/db"
import { cartItems, carts } from "@/db/schema/carts"

export class CartsRepository {
  private database: Database
  constructor(database?: Database) {
    this.database = database ?? db
  }

  async findActiveCartByUserId(userId: string) {
    return this.database.query.carts.findFirst({
      where: and(eq(carts.userId, userId), eq(carts.status, "active")),
      with: { items: true }
    })
  }

  async createCart(userId: string) {
    await this.database.insert(carts).values({ userId, status: "active" })
    // user has one cart
    return this.findActiveCartByUserId(userId)
  }

  async upsertCartItem(
    cartId: string,
    productId: string,
    variantId: string | undefined,
    quantity: number
  ) {
    // 1. Buscamos si ya existe esa combinación exacta en el carrito
    const existingItem = await this.database.query.cartItems.findFirst({
      where: and(
        eq(cartItems.cartId, cartId),
        eq(cartItems.productId, productId),
        variantId ? eq(cartItems.variantId, variantId) : isNull(cartItems.variantId)
      )
    })

    if (existingItem) {
      // 2. Si existe, sumamos la cantidad (o la pisamos, según tu regla de negocio)
      await this.database
        .update(cartItems)
        .set({ quantity: quantity }) // o existingItem.quantity + quantity
        .where(eq(cartItems.id, existingItem.id))
    } else {
      // 3. Si no existe, lo insertamos
      await this.database.insert(cartItems).values({
        cartId,
        productId,
        variantId: variantId || null,
        quantity
      })
    }
  }

  async deleteCartItem(cartId: string, productId: string, variantId: string | undefined) {
    await this.database
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, productId),
          variantId ? eq(cartItems.variantId, variantId) : isNull(cartItems.variantId)
        )
      )
  }

  async clearCart(cartId: string) {
    await this.database.delete(cartItems).where(eq(cartItems.cartId, cartId))
  }

  async markCartAsConverted(cartId: string) {
    await this.database
      .update(carts)
      .set({ status: "converted", updatedAt: new Date() })
      .where(eq(carts.id, cartId))
  }
}

export const cartsRepository = new CartsRepository()
