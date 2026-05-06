/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import * as v from "valibot"
import { productsCatalogService } from "./catalog/catalog.service"
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
  app.get(
    "/",
    {
      schema: {
        querystring: v.object({
          page: v.optional(v.pipe(v.string(), v.transform(Number))),
          limit: v.optional(v.pipe(v.string(), v.transform(Number)))
        })
      },
      preHandler: optionalAuth // Ojo: auth opcional para saber si es guest o logueado
    },
    async (request, reply) => {
      const query = request.query as { page?: number; limit?: number }
      const page = query.page && query.page > 0 ? query.page : 1
      const limit = query.limit && query.limit > 0 ? query.limit : 20

      const user = request.user
      const userTier = user ? getTierFromRole(user.role) : "retail"
      const isAuthenticated = !!user

      const productsList = await productsCatalogService.getCatalogList(
        userTier,
        isAuthenticated,
        page,
        limit
      )

      return reply.send({
        success: true,
        data: productsList,
        meta: {
          page,
          limit
          // A futuro podrías agregar un count total para la paginación real
        }
      })
    }
  )

  app.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const product = await productsService.getProductBySlug(slug)
    if (!product) {
      return reply.code(404).send({ success: false, error: "Producto no encontrado" })
    }

    return {
      success: true,
      data: { product }
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
  /**
   * GET /:productId/price?variantId=xyz&quantity=10
   * se usa GET, por semantica, idempotencia, cacheabilidad, logs y debug (la url cmpleta aparece en el log del server)
   * * En producto detalle (frontend):
   * const res = await api.get(`/products/${id}/price?variantId=${variantId}&quantity=1`)
   * * En carrito (frontend):
   * const res = await api.get(`/products/${id}/price?variantId=${variantId}&quantity=25`)
   */
  app.get(
    "/:productId/price",
    {
      schema: {
        querystring: v.object({
          variantId: v.optional(v.nullable(v.pipe(v.string(), v.cuid2()))),
          quantity: v.optional(v.pipe(v.string(), v.transform(Number), v.number(), v.minValue(1)))
        })
      },
      preHandler: optionalAuth
    },
    async (request, reply) => {
      const { productId } = request.params as { productId: string }

      const { variantId: rawVariantId, quantity: rawQuantity } = request.query as {
        variantId: string | null
        quantity?: string
      }

      // unnecesary only for security, valibot valid same
      const variantId = rawVariantId?.trim() && rawVariantId !== "null" ? rawVariantId : null

      // unnecesary only for security, valibot valid same
      const quantity = parseInt(rawQuantity || "1", 10)
      if (Number.isNaN(quantity) || quantity < 1) {
        return reply.code(400).send({
          success: false,
          error: "Cantidad inválida",
          suggestion: "La cantidad debe ser un número mayor a 0"
        })
      }

      const user = request.user
      const userTier = user ? getTierFromRole(user.role) : "retail"
      const isAuthenticated = !!user

      // Control de acceso al precio
      if (!isAuthenticated) {
        // Necesitamos saber si este producto permite ver precios al público
        const isPricePublic = await productsService.isProductWithPricePublic(productId)
        if (!isPricePublic) {
          return reply.code(403).send({
            success: false,
            error: "Precio oculto",
            suggestion: "Debes iniciar sesión para ver los precios y comprar este producto."
          })
        }
      }

      try {
        const validation = await productsPricingService.validateQuantity(
          quantity,
          productId,
          variantId || null
        )
        if (!validation.valid) {
          // error Code ORDER_INVALID_QUANTITY
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
        if (error.code === "price_not_found" || error.code === "NOT_FOUND") {
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
    }
  )

  /**
   * Obtiene todas las opciones de precio para mostrar en UI, ideal para tabla de descuentos por volumen por tier
   *
   * Ejemplo:
   * 1 - 9 unidades: $100
   * 10 - 49 unidades: $90
   * 50+ unidades: $80
   */
  app.get("/:productId/prices", { preHandler: [optionalAuth] }, async (request, _reply) => {
    const { productId } = request.params as { productId: string }
    const { variantId } = request.query as { variantId?: string }
    const user = request.user
    const userTier = user ? getTierFromRole(user.role) : "retail"
    const options = await productsPricingService.getPriceOptions(productId, variantId, userTier)
    return { success: true, data: { options } }
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

      return {
        success: true,
        data: { product }
      }
    }
  )

  app.post("/admin", { preHandler: [requireAuth, requireRole(["admin"])] }, async (request) => {
    const result = v.parse(createProductSchema, (request.body as any).product)
    const newProduct = await productsService.createProduct(result)
    return { success: true, data: { product: newProduct } }
  })

  app.put(
    "/admin/:productId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request) => {
      const { productId } = request.params as { productId: string }
      const result = v.parse(updateProductSchema, (request.body as any).product)

      // if (!result.success) {
      //   return reply.code(400).send({
      //     success: false,
      //     error: "Datos de actualización inválidos",
      //     details: v.flatten(result.issues).nested
      //   })
      // }

      const updatedProduct = await productsService.updateProduct(productId, result)
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

  /**
   * Obtiene todas las opciones de precio para el panel admin, completar inputs y editar.
   */
  app.get(
    "admin/:productId/prices",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request) => {
      const { productId } = request.params as { productId: string }
      const { variantId } = request.query as { variantId?: string }
      const options = await productsPricingService.getPriceOptions(productId, variantId)
      return { success: true, data: { options } }
    }
  )
}
