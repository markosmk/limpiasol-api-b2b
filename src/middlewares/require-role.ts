import type { FastifyReply, FastifyRequest } from "fastify"
import type { UserRole } from "@/types/fastify"

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.unauthorized("No autenticado, Debes iniciar sesión para acceder a este recurso")
    }

    const userRole = request.user?.role

    if (!userRole || !allowedRoles.includes(userRole)) {
      return reply.forbidden("No tienes permisos suficientes para realizar esta acción")
    }
  }
}
