/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import * as v from "valibot"
import { flatten, safeParse } from "valibot"
import { getTierFromRole } from "../products/lib/pricing.utils"
import { adjustingService } from "./adjusting/adjusting.service"
import {
  CancelOrderSchema,
  CreateOrderSchema,
  GetOrdersQuerySchema,
  GlobalErrorSchema,
  UpdateStatusSchema
} from "./orders.schema"
import { ordersService } from "./orders.service"
import type { FastifyInstance } from "fastify"
import type { GetOrdersQueryFilters } from "./orders.types"

import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"

export default async function ordersRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────────────────────────
  // USER ROUTES
  // ─────────────────────────────────────────────────────────

  // POST /orders - Crear nueva orden
  app.post(
    "/orders",
    {
      schema: {
        body: CreateOrderSchema,
        response: {
          201: v.object({
            success: v.literal(true),
            data: v.object({
              orderId: v.string(),
              orderCode: v.string(),
              total: v.string()
            })
          }),
          400: GlobalErrorSchema,
          // 401: GlobalErrorSchema,
          // 403: GlobalErrorSchema,
          // 404: GlobalErrorSchema,
          500: GlobalErrorSchema
        }
      },
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id // Inyectado por requireAuth
        const parsed = safeParse(CreateOrderSchema, request.body)

        if (!parsed.success) {
          const issues = flatten(parsed.issues)
          console.log(issues)
          throw new Error("Validación fallida")
          // return reply.code(400).send({
          //   error: "Validación fallida",
          //   code: "VALIDATION_ERROR",
          //   details: issues
          // })
        }

        const user = request.user
        const userTier = user ? getTierFromRole(user.role) : "retail"

        const result = await ordersService.createOrder(userId, userTier, parsed.output)

        return reply.code(201).send({ success: true, data: result })
      } catch (err) {
        app.log.error(err)
        throw err
        //   if (err instanceof AppError) {
        //     return reply.code(400).send({ error: err.message, code: err.code, details: null })
        //   }
        //   app.log.error(err)
        //   // console.log(err)
        //   // throw new Error((err as Error)?.message || "Error interno")
        //   return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // GET /orders - Listar mis órdenes
  app.get(
    "/orders",
    {
      schema: {
        querystring: v.object({
          page: v.optional(v.pipe(v.number(), v.minValue(1))),
          limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
          status: v.optional(
            v.union([v.literal("pending"), v.literal("paid"), v.literal("cancelled")])
          )
        }),
        response: {
          200: v.object({
            success: v.literal(true),
            data: v.object({
              orders: v.array(v.any()), // Tipar más específico si querés
              total: v.number(),
              hasMore: v.boolean()
            })
          })
        }
      },
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { page = 1, limit = 20, status } = request.query as any

        const result = await ordersService.getOrders({
          userId,
          status: status as any,
          limit,
          offset: (page - 1) * limit,
          orderBy: "createdAt",
          orderDir: "desc"
        })

        return reply.send({ success: true, data: result })
      } catch (err) {
        app.log.error(err)
        throw err
        // throw new Error((err as Error)?.message || "Error interno")
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // GET /orders/:id - Detalle de mi orden
  app.get(
    "/orders/:id",
    {
      schema: {
        params: v.object({ id: v.string() }),
        response: {
          200: v.object({ success: v.literal(true), data: v.any() }),
          404: GlobalErrorSchema
          // 404: v.object({ error: v.string(), code: v.string() })
        }
      },
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params as { id: string }

        const order = await ordersService.getCustomerOrder(id, userId)

        return reply.send({ success: true, data: order })
      } catch (err) {
        // if (err instanceof AppError && err.code === "ORDER_FORBIDDEN") {
        //   return reply.code(404).send({ error: "Orden no encontrada", code: "ORDER_NOT_FOUND" })
        // }
        // if (err instanceof AppError) {
        //   return reply.send({ error: err.message, code: err.code })
        // }
        app.log.error(err)
        throw err
        // throw new Error((err as Error)?.message || "Error interno")
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // POST /orders/:id/cancel - Cancelar mi orden
  app.post(
    "/orders/:id/cancel",
    {
      schema: {
        params: v.object({ id: v.string() }),
        body: CancelOrderSchema,
        response: {
          200: v.object({ success: v.literal(true), data: v.object({ orderId: v.string() }) })
          // 400: v.object({ error: v.string(), code: v.string() })
        }
      },
      preHandler: requireAuth
    },
    async (request, reply) => {
      try {
        const userId = request.user!.id
        const { id } = request.params as { id: string }
        const { reason } = request.body as { reason: string }

        // Verificar que la orden pertenece al usuario primero
        await ordersService.getCustomerOrder(id, userId)

        await ordersService.updateOrderStatus(id, "cancelled", userId, { reason, isCustomer: true })

        return reply.send({ success: true, data: { orderId: id } })
      } catch (err) {
        app.log.error(err)
        throw err
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // app.log.error(err)
        // throw new Error((err as Error)?.message || "Error interno")
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // ─────────────────────────────────────────────────────────
  // ADMIN ROUTES
  // ─────────────────────────────────────────────────────────

  // GET /admin/orders - Listar todas las órdenes (con filtros)
  app.get(
    "/admin/orders",
    {
      schema: {
        querystring: GetOrdersQuerySchema
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { page = 1, limit = 50, ...filters } = request.query as GetOrdersQueryFilters

        const result = await ordersService.getOrders({
          ...filters,
          limit,
          offset: (page - 1) * limit,
          orderBy: "createdAt",
          orderDir: "desc"
        })

        return reply.send({ success: true, data: result })
      } catch (err) {
        app.log.error(err)
        throw err
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // GET /admin/orders/:id - Ver cualquier orden (soporte)
  app.get(
    "/admin/orders/:id",
    {
      schema: {
        params: v.object({ id: v.string() })
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const order = await ordersService.getAdminOrder(id)

        return reply.send({ success: true, data: order })
      } catch (err) {
        app.log.error(err)
        throw err
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // app.log.error(err)
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // PATCH /admin/orders/:id/status - Cambiar estado (admin)
  app.patch(
    "/admin/orders/:id/status",
    {
      schema: {
        params: v.object({ id: v.string() }),
        body: UpdateStatusSchema
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const { status, reason } = request.body as { status: any; reason?: string }
        const admin = request.user! // Inyectado por requireAdmin

        await ordersService.updateOrderStatus(id, status, admin.id, {
          reason,
          adminNote: `Cambiado por admin: ${admin.id}`
        })

        return reply.send({ success: true, data: { orderId: id, newStatus: status } })
      } catch (err) {
        app.log.error(err)
        throw err
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // POST /admin/orders/:id/notes - Agregar nota interna
  app.post(
    "/admin/orders/:id/notes",
    {
      schema: {
        params: v.object({ id: v.string() }),
        body: v.object({
          content: v.pipe(v.string(), v.minLength(1)),
          type: v.optional(
            v.union([
              v.literal("general"),
              v.literal("urgent"),
              v.literal("customer"),
              v.literal("logistics")
            ])
          )
        })
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const { content, type } = request.body as { content: string; type?: any }
        const admin = request.user!

        // TODO: name is not save in request user.
        await ordersService.addInternalNote(id, { id: admin.id, name: "admin" }, content, type)

        return reply.send({ success: true })
      } catch (err) {
        app.log.error(err)
        throw err
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // app.log.error(err)
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // ─────────────────────────────────────────────────────────
  // ADJUSTING ROUTES
  // ─────────────────────────────────────────────────────────

  // PATCH /admin/orders/:id/delivery - Cambiar tipo de entrega
  app.patch(
    "/admin/orders/:id/delivery",
    {
      schema: {
        params: v.object({ id: v.string() }),
        body: v.object({
          deliveryType: v.union([v.literal("shipping"), v.literal("pickup")]),
          // Si no podés importar los schemas AddressSchema y Pickup, dejalos como v.any() o copialos
          shippingData: v.optional(v.any()),
          pickupLocationData: v.optional(v.any())
        }),
        response: {
          200: v.object({ success: v.literal(true), newDeliveryType: v.string() }),
          400: GlobalErrorSchema,
          500: GlobalErrorSchema
        }
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { deliveryType, shippingData, pickupLocationData } = request.body as any
      const admin = request.user!

      const result = await adjustingService.changeDeliveryType(
        id,
        deliveryType,
        { shippingData, pickupLocationData },
        { id: admin.id, name: "Admin" }
      )

      return reply.send(result)
    }
  )

  // PATCH /admin/orders/:id/pricing - Ajuste manual (Descuentos o Recargos extra)
  app.patch(
    "/admin/orders/:id/pricing",
    {
      schema: {
        params: v.object({ id: v.string() }),
        body: v.object({
          adjustment: v.string("Debe ser un string numérico, ej: '-500' o '150.50'"),
          reason: v.pipe(v.string(), v.minLength(3, "El motivo es muy corto")),
          notifyCustomer: v.optional(v.boolean())
        })
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const { adjustment, reason, notifyCustomer } = request.body as any
        const admin = request.user!

        const result = await adjustingService.applyManualAdjustment(
          id,
          adjustment,
          reason,
          { id: admin.id, name: "Admin" }, // TODO: no se guarda el nombre del admin en la sesion..
          notifyCustomer
        )

        return reply.send(result)
      } catch (err) {
        app.log.error(err)
        throw err
      }
    }
  )

  // PATCH /admin/orders/:id/items/add - Agregar producto a la orden
  app.patch(
    "/admin/orders/:id/items/add",
    {
      schema: {
        params: v.object({ id: v.string() }),
        body: v.object({
          productId: v.string(),
          variantId: v.string(),
          quantity: v.number()
        })
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string }
        const { productId, variantId, quantity } = request.body as {
          productId: string
          variantId: string
          quantity: number
        }
        const admin = request.user!

        await adjustingService.addOrderItem(id, { productId, variantId, quantity }, admin)

        return reply.send({ success: true })
      } catch (err) {
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // app.log.error(err)
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
        app.log.error(err)
        throw err
      }
    }
  )

  // PATCH /admin/orders/:id/items/:itemId - Actualizar cantidad
  app.patch(
    "/admin/orders/:id/items/:itemId",
    {
      schema: {
        params: v.object({ id: v.string(), itemId: v.string() }),
        body: v.object({
          quantity: v.pipe(v.number(), v.minValue(1))
        })
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id, itemId } = request.params as { id: string; itemId: string }
        const { quantity } = request.body as { quantity: number }
        const admin = request.user!

        const result = await adjustingService.updateOrderItemQuantity(id, itemId, quantity, admin)

        return reply.send(result)
      } catch (err) {
        app.log.error(err)
        throw err
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )

  // DELETE /admin/orders/:id/items/:itemId - Remover item
  app.delete(
    "/admin/orders/:id/items/:itemId",
    {
      schema: {
        params: v.object({ id: v.string(), itemId: v.string() })
      },
      preHandler: [requireAuth, requireRole(["admin"])]
    },
    async (request, reply) => {
      try {
        const { id, itemId } = request.params as { id: string; itemId: string }
        const admin = request.user!

        const result = await adjustingService.removeOrderItem(id, itemId, admin)

        return reply.send(result)
      } catch (err) {
        app.log.error(err)
        throw err
        // if (err instanceof AppError) {
        //   return reply.code(400).send({ error: err.message, code: err.code })
        // }
        // return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" })
      }
    }
  )
}
