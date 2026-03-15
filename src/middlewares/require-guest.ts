import type { FastifyReply, FastifyRequest } from "fastify"

import { authService } from "@/domains/auth/auth.service"

/**
 * Optional, to implement on urls: /login, /register, /forgot-password, /reset-password
 */
export async function requireGuest(req: FastifyRequest, reply: FastifyReply) {
  const sessionId = req.cookies.session
  if (sessionId) {
    const session = await authService.validateSession(sessionId)
    if (session?.userId) {
      return reply.code(409).send({
        success: false,
        error: "Ya autenticado",
        message: "Ya tienes una sesión activa",
        redirect: "/panel"
      })
    }
  }
}
