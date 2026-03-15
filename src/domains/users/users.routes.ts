import * as v from "valibot"
import { listUsersSchema, updateRoleSchema, updateStatusSchema } from "./users.schema"
import { usersService } from "./users.service"
import type { FastifyInstance } from "fastify"

import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"
import { AppError } from "@/utils/app-error"

export default async function usersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)
  app.addHook("preHandler", requireRole(["admin"]))

  app.get("/", async (request) => {
    const query = v.parse(listUsersSchema, request.query)
    return await usersService.listUsers(query)
  })

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string }
    return await usersService.getUser(id)
  })

  app.patch("/:id/status", async (request) => {
    const { id } = request.params as { id: string }
    const body = v.parse(updateStatusSchema, request.body)
    await usersService.updateStatus(id, body)
    return { success: true, message: "Estado de usuario actualizado" }
  })

  app.patch("/:id/role", async (request) => {
    const { id } = request.params as { id: string }
    const body = v.parse(updateRoleSchema, request.body)
    await usersService.updateRole(id, body)
    return { success: true, message: "Rol de usuario actualizado" }
  })

  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string }

    if (id === request.user?.id) {
      throw new AppError({
        code: "custom",
        message: "No puedes eliminar tu propia cuenta de administrador",
        statusCode: 400
      })
    }

    await usersService.deleteUser(id)
    return { success: true, message: "Usuario eliminado correctamente" }
  })
}
