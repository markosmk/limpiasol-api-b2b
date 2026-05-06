import { and, eq, lt } from "drizzle-orm"

import { type Database, db } from "@/db"
import { cartItems, carts } from "@/db/pg"

export class CartsRepository {
  private database: Database
  constructor(database?: Database) {
    this.database = database ?? db
  }

  async findActiveCartByUserId(userId: string) {
    return this.database.query.carts.findFirst({
      where: and(eq(carts.userId, userId), eq(carts.status, "active")),
      with: { 
        items: {
          with: { variant: { columns: { productId: true } } }
        }
      }
    })
  }

  async createCart(userId: string) {
    const [cart] = await this.database
      .insert(carts)
      .values({ userId, status: "active" })
      .returning()
    if (!cart) return null

    return await this.database.query.carts.findFirst({
      where: and(eq(carts.userId, userId), eq(carts.id, cart.id), eq(carts.status, "active")),
      with: { 
        items: {
          with: { variant: { columns: { productId: true } } }
        }
      }
    })
  }

  async findCartItem(cartId: string, variantId: string) {
    return this.database.query.cartItems.findFirst({
      where: and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId))
    })
  }

  async insertCartItem(cartId: string, variantId: string, quantity: number) {
    await this.database.insert(cartItems).values({
      cartId,
      variantId,
      quantity
    })
  }

  async updateCartItemQuantity(itemId: string, quantity: number) {
    await this.database.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId))
  }

  async deleteCartItem(cartId: string, variantId: string) {
    await this.database
      .delete(cartItems)
      .where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)))
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

  // TODO: implement on cron job or on user login, or get active cart
  // ej:
  // this.cartsRepository.cleanupOldCarts(userId).catch(err => {
  //     // si falla, no nos importa, no bloqueamos la respuesta al cliente
  //     console.error(`Error limpiando carritos viejos del user ${userId}:`, err)
  //   })
  async cleanupOldCarts(userId: string) {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    await this.database.delete(carts).where(
      and(
        eq(carts.userId, userId),
        eq(carts.status, "converted"), // ["converted", "abandoned"]
        lt(carts.updatedAt, thirtyDaysAgo)
      )
    )
  }
}

export const cartsRepository = new CartsRepository()
