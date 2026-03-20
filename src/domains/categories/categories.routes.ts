import * as v from "valibot"
import {
  bulkAssignProductsSchema,
  createCategorySchema,
  updateCategorySchema
} from "./categories.schema"
import { categoriesService } from "./categories.service"
import type { FastifyInstance } from "fastify"

import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"

export default async function categoriesRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────
  // RUTAS FRONTEND
  // ─────────────────────────────────────
  app.get("/", async (_request) => {
    const categories = await categoriesService.getPublic()
    return { success: true, data: { categories } }
  })

  app.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const category = await categoriesService.getBySlug(slug)
    if (!category) {
      return reply.code(404).send({ success: false, error: "Categoría no encontrada" })
    }
    return { success: true, data: { category } }
  })

  // ─────────────────────────────────────
  // RUTAS ADMIN
  // ─────────────────────────────────────
  app.get("/admin", { preHandler: [requireAuth, requireRole(["admin"])] }, async () => {
    const categories = await categoriesService.getAll()
    return { success: true, data: { categories } }
  })

  app.get(
    "/admin/:categoryId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string }
      const category = await categoriesService.getById(categoryId)
      if (!category) {
        return reply.code(404).send({ success: false, error: "Categoría no encontrada" })
      }
      return { success: true, data: { category } }
    }
  )

  app.post(
    "/admin",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const result = v.safeParse(
        createCategorySchema,
        (request.body as { category: unknown }).category
      )
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de categoría inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      const newCategory = await categoriesService.create(result.output)
      return { success: true, data: { category: newCategory } }
    }
  )

  app.put(
    "/admin/:categoryId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string }
      const result = v.safeParse(
        updateCategorySchema,
        (request.body as { category: unknown }).category
      )

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de actualización inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      const updatedCategory = await categoriesService.update(categoryId, result.output)
      return { success: true, data: { category: updatedCategory } }
    }
  )

  app.delete(
    "/admin/:categoryId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request) => {
      const { categoryId } = request.params as { categoryId: string }
      await categoriesService.delete(categoryId)
      return { success: true }
    }
  )

  // Bulk assignment
  app.post(
    "/admin/bulk-assign",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const result = v.safeParse(bulkAssignProductsSchema, request.body)
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de asignación inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      await categoriesService.bulkAssign(result.output)
      return { success: true, message: "Productos asignados exitosamente" }
    }
  )
}
