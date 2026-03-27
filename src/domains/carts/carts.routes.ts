import { getTierFromRole } from "../products/lib/pricing.utils"
import { productsPricingService } from "../products/pricing/pricing.service"
import { CartsRepository } from "./carts.repository"
import { AddToCartDto, UpdateCartItemDto } from "./carts.schema"
import { CartsService } from "./carts.service"
import type { FastifyInstance, FastifyRequest } from "fastify"
import type * as v from "valibot"

import { requireAuth } from "@/middlewares/require-auth"

export default async function cartsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)

  const repository = new CartsRepository(app.db)
  const cartsService = new CartsService(repository, productsPricingService)

  // GET /carts - Obtener el carrito actual
  app.get("/", async (req: FastifyRequest) => {
    const user = req.user

    const userTier = user ? getTierFromRole(user.role) : "retail"
    return cartsService.getActiveCartHydrated(user!.id, userTier)
  })

  // POST /carts/items - Agregar item (o sumar cantidad si existe)
  app.post(
    "/items",
    {
      schema: { body: AddToCartDto }
    },
    async (req) => {
      const user = req.user
      const body = req.body as v.InferOutput<typeof AddToCartDto>

      const userTier = user ? getTierFromRole(user.role) : "retail"
      return cartsService.addItem(user!.id, body, userTier)
    }
  )

  // PATCH /carts/items/:productId - Modificar cantidad exacta (0 para borrar)
  app.patch(
    "/items/:productId",
    {
      schema: { body: UpdateCartItemDto }
    },
    async (req) => {
      const user = req.user
      const { productId } = req.params as { productId: string }
      const { variantId, quantity } = req.body as v.InferOutput<typeof UpdateCartItemDto>

      const userTier = user ? getTierFromRole(user.role) : "retail"
      return cartsService.updateItemQuantity(user!.id, productId, variantId, quantity, userTier)
    }
  )

  // DELETE /carts - Vaciar carrito
  app.delete("/", async (req) => {
    const userId = req.user!.id
    return cartsService.clearCart(userId)
  })
}
