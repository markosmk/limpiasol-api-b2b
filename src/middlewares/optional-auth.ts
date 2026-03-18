import type { FastifyReply, FastifyRequest } from "fastify"

import { authService } from "@/domains/auth/auth.service"

export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) {
  try {
    const sessionId = request.cookies?.session
    if (!sessionId) return

    const session = await authService.validateSession(sessionId)
    if (session?.userId) {
      request.user = {
        id: session.userId,
        role: session.role
      }
    }
  } catch (error) {
    request.log.warn({ error }, "Optional auth failed")
  }
}
