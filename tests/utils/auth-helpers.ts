import { eq } from "drizzle-orm"

import { db } from "@/db"
import { users } from "@/db/schema"
import { authService } from "@/domains/auth/auth.service"
import { hashPassword } from "@/utils/auth/hash"

export type TestUserContext = {
  user: { id: string }
  sessionId: string
  cleanup: () => Promise<void>
}

export async function createTestUserAndSession(
  role: "user" | "reseller" | "admin" = "user"
): Promise<TestUserContext> {
  const testId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const email = `test-${role}-${testId}@example.com`

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword("password123"),
      role: role,
      status: "active",
      emailVerified: true,
      name: `Test ${role}`
    })
    .$returningId()

  const session = await authService.createSession(user.id)

  const cleanup = async () => {
    // session was deleted by trigger when delete user
    // await db.delete(session).where(eq(session.userId, user.id))
    await db.delete(users).where(eq(users.id, user.id))
  }

  return { user, sessionId: session.sessionId, cleanup }
}
