import type { Database } from "@/db"
import "fastify"

export type UserRole = "admin" | "staff" | "reseller" | "customer"

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; role: UserRole } | null
  }

  interface FastifyInstance {
    db: Database
    requireRole: (roles: UserRole[]) => HookHandler<FastifyRequest, FastifyReply>
  }
}
