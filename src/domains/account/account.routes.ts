import * as v from "valibot"
import { changePasswordSchema, updateMeSchema } from "./account.schema"
import { accountService } from "./account.service"
import type { FastifyInstance } from "fastify"

import { requireAuth } from "@/middlewares/require-auth"

export default async function accountRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)

  app.get("/me", async (request) => {
    return await accountService.getMe(request.user!.id)
  })

  app.patch("/me", async (request) => {
    const body = v.parse(updateMeSchema, request.body)
    return await accountService.updateMe(request.user!.id, body)
  })

  app.post("/me/change-password", async (request, reply) => {
    const body = v.parse(changePasswordSchema, request.body)
    await accountService.changePassword(request.user!.id, body.oldPassword, body.newPassword)

    reply.clearCookie("session", { path: "/" })

    return {
      success: true,
      message: "Contraseña actualizada. Por seguridad, inicie sesión de nuevo."
    }
  })

  app.get("/me/sessions", async (request) => {
    const sessionId = request.cookies.session
    return await accountService.listSessions(request.user!.id, sessionId)
  })

  app.delete("/me/sessions", async (request) => {
    const sessionId = request.cookies.session
    await accountService.revokeAllSessions(request.user!.id, sessionId)
    return { success: true, message: "Otras sesiones cerradas, tu sesión actual permanece activa." }
  })

  app.delete("/me/sessions/:id", async (request, reply) => {
    const { id } = request.params as { id: string }
    const currentSessionId = request.cookies.session

    await accountService.revokeSession(request.user!.id, id)

    if (id === currentSessionId) {
      reply.clearCookie("session", { path: "/" })
    }

    return { success: true, message: "Sesión terminada" }
  })
}
