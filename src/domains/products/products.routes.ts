/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import * as v from "valibot"
import { getTierFromRole } from "./lib/pricing.utils"
import { productsPricingService } from "./pricing/pricing.service"
import { createProductSchema, updateProductSchema } from "./products.schema"
import { productsService } from "./products.service"
import type { FastifyInstance } from "fastify"

import { optionalAuth } from "@/middlewares/optional-auth"
import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"

export default async function productsRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────
  // FRONTEND ROUTES (Catalog / Client)
  // ─────────────────────────────────────
  app.get("/", async (_request, reply) => {
    reply.send({ success: true, data: [] })
  })

  app.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const product = await productsService.getProductBySlug(slug)
    if (!product) {
      return reply.code(404).send({ success: false, error: "Producto no encontrado" })
    }
    const displayPrice = await productsPricingService.getDisplayPrice(product.id)

    return {
      success: true,
      data: {
        product,
        pricing: {
          base: displayPrice,
          note:
            displayPrice.minQuantity > 1
              ? `Precio por unidad (mín. ${displayPrice.minQuantity})`
              : "Precio por unidad"
        }
      }
    }
  })

  /**
   * get not cant send body, for that reason use post to get prices
   *
   * puede ser usado en detalle de producto o para carrito
   *
   * En producto detalle (frontend):
   * const basePrice = await api.post(`/products/${id}/price`, {
   *   quantity: 1  // o rules.minQuantity
   * })
   * Muestra: "Precio: $100 c/u" o "Desde $100 (mín. 10 un.)"
   *
   * En carrito (frontend):
   * const cartPrice = await api.post(`/products/${id}/price`, {
   *   quantity: 25  // cantidad real que quiere comprar
   * })
   * Muestra: "Subtotal: $2000 (ahorraste 15% por volumen)"
   *
   */
  app.post("/:productId/price", { preHandler: optionalAuth }, async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const { variantId, quantity } = request.body as {
      variantId?: string
      quantity: number
    }

    if (!quantity || quantity < 1) {
      return reply.code(400).send({
        success: false,
        error: "Cantidad inválida",
        suggestion: "La cantidad debe ser mayor a 0"
      })
    }

    const user = request.user
    const userTier = user ? getTierFromRole(user.role) : "retail"

    try {
      const validation = await productsPricingService.validateQuantity(
        productId,
        quantity,
        variantId
      )
      if (!validation.valid) {
        return reply.code(validation.code === "not_found" ? 404 : 400).send({
          success: false,
          error: validation.error,
          suggestion: validation.suggestion,
          code: validation.code
        })
      }

      const pricing = await productsPricingService.calculatePrice({
        productId,
        variantId,
        userTier,
        quantity
      })

      return {
        success: true,
        data: {
          productId,
          variantId,
          quantity,
          pricing,
          userTier
        }
      }
    } catch (error: any) {
      if (error.code === "price_not_found") {
        return reply.code(404).send({
          success: false,
          error: "Precio no disponible",
          message: error.message
        })
      }

      request.log.error({ error, productId, variantId }, "Price calculation failed")
      return reply.code(500).send({
        success: false,
        error: "Error interno al calcular precio,",
        message: process.env.NODE_ENV === "test" ? error.message : undefined
      })
    }
  })

  // ─────────────────────────────────────
  // RUTAS ADMIN (Gestion / Backoffice)
  // ─────────────────────────────────────

  app.get("/admin", { preHandler: [requireAuth, requireRole(["admin"])] }, async () => {
    const products = await productsService.getAllProducts()
    return { success: true, data: { products } }
  })

  app.get(
    "/admin/:productId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const { productId } = request.params as { productId: string }

      const product = await productsService.getProductById(productId)
      if (!product) {
        return reply.code(404).send({ success: false, error: "Producto no encontrado" })
      }
      const displayPrice = await productsPricingService.getDisplayPrice(productId)

      return {
        success: true,
        data: {
          product,
          pricing: {
            base: displayPrice,
            note:
              displayPrice.minQuantity > 1
                ? `Precio por unidad (mín. ${displayPrice.minQuantity})`
                : "Precio por unidad"
          }
        }
      }
    }
  )

  app.post(
    "/admin",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const result = v.safeParse(createProductSchema, (request.body as any).product)
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de producto inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      const newProduct = await productsService.createProduct(result.output)
      return { success: true, data: { product: newProduct } }
    }
  )

  app.put(
    "/admin/:productId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const { productId } = request.params as { productId: string }
      const result = v.safeParse(updateProductSchema, (request.body as any).product)

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de actualización inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      const updatedProduct = await productsService.updateProduct(productId, result.output)
      return { success: true, data: { product: updatedProduct } }
    }
  )

  app.delete(
    "/admin/:productId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request) => {
      const { productId } = request.params as { productId: string }
      await productsService.deleteProduct(productId)
      return { success: true }
    }
  )

  // opciones de precio (para mostrar en catálogo/admin)
  app.get("/:productId/prices", async (request, _reply) => {
    const { productId } = request.params as { productId: string }
    const { variantId } = request.query as { variantId?: string }
    const options = await productsPricingService.getPriceOptions(productId, variantId)
    return { success: true, data: { options } }
  })
}
