import { and, eq, ne, sql } from "drizzle-orm"

import { db } from "@/db"
import { session as sessions } from "@/db/pg/auth"
import { users } from "@/db/pg/users"

// Pre-compiled queries for Postgres performance
const findUserByIdQuery = db
  .select({
    id: users.id,
    email: users.email,
    name: users.name,
    phone: users.phone,
    ivaCategory: users.ivaCategory,
    profileInfo: users.profileInfo,
    role: users.role,
    status: users.status,
    createdAt: users.createdAt
  })
  .from(users)
  .where(eq(users.id, sql.placeholder("id")))
  .prepare("account_find_user_by_id")

const listUserSessionsQuery = db
  .select({
    id: sessions.id,
    expiresAt: sessions.expiresAt,
    createdAt: sessions.createdAt,
    ipAddress: sessions.ipAddress,
    userAgent: sessions.userAgent
  })
  .from(sessions)
  .where(eq(sessions.userId, sql.placeholder("userId")))
  .prepare("account_list_user_sessions")

export const accountRepository = {
  async findUserById(id: string) {
    const [user] = await findUserByIdQuery.execute({ id })
    return user
  },

  async updateUser(id: string, data: Partial<typeof users.$inferInsert>) {
    await db.update(users).set(data).where(eq(users.id, id))
  },

  async listUserSessions(userId: string) {
    return await listUserSessionsQuery.execute({ userId })
  },

  async revokeSession(userId: string, sessionId: string) {
    await db.delete(sessions).where(and(eq(sessions.userId, userId), eq(sessions.id, sessionId)))
  },

  async revokeAllSessions(userId: string, exceptSessionId?: string) {
    if (exceptSessionId) {
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.id, exceptSessionId)))
    } else {
      await db.delete(sessions).where(eq(sessions.userId, userId))
    }
  }
}
