import { and, desc, eq, sql } from "drizzle-orm"

import { db } from "@/db"
import { session as sessions, verificationTokens } from "@/db/pg/auth"
import { users } from "@/db/pg/users"

const findUserByEmailQuery = db
  .select()
  .from(users)
  .where(eq(users.email, sql.placeholder("email")))
  .prepare("auth_find_user_by_email")

const findUserByIdQuery = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder("id")))
  .prepare("auth_find_user_by_id")

const findSessionWithUserQuery = db
  .select({
    userId: users.id,
    role: users.role,
    expiresAt: sessions.expiresAt
  })
  .from(sessions)
  .innerJoin(users, eq(users.id, sessions.userId))
  .where(eq(sessions.id, sql.placeholder("sessionId")))
  .limit(1)
  .prepare("auth_find_session_with_user")

export const authRepository = {
  async createUser(user: {
    email: string
    passwordHash: string
    status?: "pending_approval" | "active" | "rejected" | "suspended"
    emailVerified?: boolean
  }) {
    // Postgres supports RETURNING to get the full row back immediately
    const [fullUser] = await db
      .insert(users)
      .values({
        email: user.email,
        passwordHash: user.passwordHash,
        status: user.status,
        emailVerified: user.emailVerified
      })
      .returning()

    return fullUser!
  },

  async createVerificationToken(data: {
    userId: string
    token: string
    type: "email_verification" | "password_reset"
    expiresAt: Date
  }) {
    await db.insert(verificationTokens).values({
      id: data.token,
      userId: data.userId,
      type: data.type,
      expiresAt: data.expiresAt
    })
  },

  async findVerificationToken(token: string) {
    const [result] = await db
      .select()
      .from(verificationTokens)
      .where(eq(verificationTokens.id, token))
    return result
  },

  async deleteVerificationToken(token: string) {
    await db.delete(verificationTokens).where(eq(verificationTokens.id, token))
  },

  async verifyUserEmail(userId: string) {
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId))
  },

  async findUserByEmail(email: string) {
    const [user] = await findUserByEmailQuery.execute({ email })
    return user
  },

  async findUserById(id: string) {
    const [user] = await findUserByIdQuery.execute({ id })
    return user
  },

  async findSessionWithUser(sessionId: string) {
    const result = await findSessionWithUserQuery.execute({ sessionId })
    return result[0] ?? null
  },

  async createSession(session: {
    id: string
    userId: string
    expiresAt: Date
    ipAddress?: string
    userAgent?: string
  }) {
    await db.insert(sessions).values({
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent
    })
  },

  async findSession(sessionId: string) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId))
    return session ?? null
  },

  async deleteSession(sessionId: string) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  },

  async updateSessionExpiry(id: string, expiresAt: Date) {
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id))
  },

  async updateUserPassword(userId: string, passwordHash: string) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
  },

  async deleteVerificationTokensByUser(
    userId: string,
    type: "email_verification" | "password_reset"
  ) {
    await db
      .delete(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, type)))
  },

  async findLatestVerificationToken(userId: string, type: "email_verification" | "password_reset") {
    const [result] = await db
      .select()
      .from(verificationTokens)
      .where(and(eq(verificationTokens.userId, userId), eq(verificationTokens.type, type)))
      .orderBy(desc(verificationTokens.createdAt))
      .limit(1)
    return result
  },

  async deleteUserSessions(userId: string) {
    await db.delete(sessions).where(eq(sessions.userId, userId))
  }
}
