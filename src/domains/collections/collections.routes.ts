import * as v from "valibot"
import {
  bulkAssignProductsCollectionSchema,
  createCollectionSchema,
  updateCollectionSchema
} from "./collections.schema"
import { collectionsService } from "./collections.service"
import type { FastifyInstance } from "fastify"

import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"

export default async function collectionsRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────
  // RUTAS FRONTEND
  // ─────────────────────────────────────
  app.get("/", async (_request) => {
    const collections = await collectionsService.getPublic()
    return { success: true, data: { collections } }
  })

  app.get("/slug/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const collection = await collectionsService.getBySlug(slug)
    if (!collection) {
      return reply.code(404).send({ success: false, error: "Colección no encontrada" })
    }
    return { success: true, data: { collection } }
  })

  // ─────────────────────────────────────
  // RUTAS ADMIN
  // ─────────────────────────────────────
  app.get("/admin", { preHandler: [requireAuth, requireRole(["admin"])] }, async () => {
    const collections = await collectionsService.getAll()
    return { success: true, data: { collections } }
  })

  app.get(
    "/admin/:collectionId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const { collectionId } = request.params as { collectionId: string }
      const collection = await collectionsService.getById(collectionId)
      if (!collection) {
        return reply.code(404).send({ success: false, error: "Colección no encontrada" })
      }
      return { success: true, data: { collection } }
    }
  )

  app.post(
    "/admin",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const result = v.safeParse(
        createCollectionSchema,
        (request.body as { collection: unknown }).collection
      )
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de colección inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      const newCollection = await collectionsService.create(result.output)
      return { success: true, data: { collection: newCollection } }
    }
  )

  app.put(
    "/admin/:collectionId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const { collectionId } = request.params as { collectionId: string }
      const result = v.safeParse(
        updateCollectionSchema,
        (request.body as { collection: unknown }).collection
      )

      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de actualización inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      const updatedCollection = await collectionsService.update(collectionId, result.output)
      return { success: true, data: { collection: updatedCollection } }
    }
  )

  app.delete(
    "/admin/:collectionId",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request) => {
      const { collectionId } = request.params as { collectionId: string }
      await collectionsService.delete(collectionId)
      return { success: true }
    }
  )

  // Bulk assignment
  app.post(
    "/admin/bulk-assign",
    { preHandler: [requireAuth, requireRole(["admin"])] },
    async (request, reply) => {
      const result = v.safeParse(bulkAssignProductsCollectionSchema, request.body)
      if (!result.success) {
        return reply.code(400).send({
          success: false,
          error: "Datos de asignación inválidos",
          details: v.flatten(result.issues).nested
        })
      }

      await collectionsService.bulkAssign(result.output)
      return { success: true, message: "Productos asignados exitosamente" }
    }
  )
}
