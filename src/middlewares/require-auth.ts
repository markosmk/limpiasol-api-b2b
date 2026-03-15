import type { FastifyReply, FastifyRequest } from "fastify"
import type { UserRole } from "@/types/fastify"

import { authService } from "@/domains/auth/auth.service"

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = request.cookies.session
  if (!sessionId) {
    return reply.unauthorized("No autenticado, Debes iniciar sesión para acceder a este recurso")
  }

  const user = await authService.validateSession(sessionId)
  if (!user) {
    return reply.unauthorized("Sesión inválida, Debes iniciar sesión para acceder a este recurso")
  }

  request.user = {
    id: user.userId,
    role: user.role as UserRole
  }
}
