import type { UserRole } from "@/types/fastify"

export interface AuthUser {
  id: string
  role: UserRole
}
