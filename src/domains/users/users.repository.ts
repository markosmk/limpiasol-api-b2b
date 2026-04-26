import { and, count, eq, sql } from "drizzle-orm"
import type { ListUsersInput, UpdateRoleInput, UpdateStatusInput } from "./users.schema"

import { db } from "@/db"
import { users } from "@/db/pg/users"

const findByIdQuery = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder("id")))
  .prepare("users_find_by_id")

export const usersRepository = {
  async list(filters: ListUsersInput) {
    const where = and(
      filters.status ? eq(users.status, filters.status) : undefined,
      filters.role ? eq(users.role, filters.role) : undefined
    )

    const limit = filters.limit || 20
    const offset = ((filters.page || 1) - 1) * limit

    const [totalResult] = await db.select({ total: count() }).from(users).where(where)

    const data = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        emailVerified: users.emailVerified,
        phone: users.phone,
        cuit: users.cuit
      })
      .from(users)
      .where(where)
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${users.createdAt} DESC`)

    return {
      data,
      total: totalResult.total,
      page: filters.page || 1,
      limit
    }
  },

  async findById(id: string) {
    const [user] = await findByIdQuery.execute({ id })
    return user
  },

  async updateStatus(id: string, data: UpdateStatusInput) {
    await db
      .update(users)
      .set({
        status: data.status,
        banReason: data.reason || null,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
  },

  async updateRole(id: string, data: UpdateRoleInput) {
    await db
      .update(users)
      .set({
        role: data.role,
        adminLevel: data.adminLevel || null,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
  },

  async delete(id: string) {
    // Soft delete or suspension is better, but we implement physical delete for now
    await db.delete(users).where(eq(users.id, id))
  }
}
