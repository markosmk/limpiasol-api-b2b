import * as v from "valibot"

import { adminLevelValues, userRoleValues, userStatusValues } from "@/db/pg/users"

export const listUsersSchema = v.object({
  status: v.optional(v.picklist(userStatusValues, "Estado inválido")),
  role: v.optional(v.picklist(userRoleValues, "Rol inválido")),
  page: v.optional(v.pipe(v.unknown(), v.transform(Number), v.number()), 1),
  limit: v.optional(v.pipe(v.unknown(), v.transform(Number), v.number()), 20)
})

export type ListUsersInput = v.InferOutput<typeof listUsersSchema>

export const updateStatusSchema = v.object({
  status: v.picklist(userStatusValues, "Estado inválido"),
  reason: v.optional(v.string("Razón inválida"))
})

export type UpdateStatusInput = v.InferOutput<typeof updateStatusSchema>

export const updateRoleSchema = v.object({
  role: v.picklist(userRoleValues, "Rol inválido"),
  adminLevel: v.optional(v.picklist(adminLevelValues, "Nivel de admin inválido"))
})

export type UpdateRoleInput = v.InferOutput<typeof updateRoleSchema>
