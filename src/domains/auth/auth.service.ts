import { authRepository } from "./auth.repository"

import { appEvents, EventTypes } from "@/events/emitter"
import { AppError } from "@/utils/app-error"
import { hashPassword, verifyPassword } from "@/utils/auth/hash"
import { createSessionExpiry, generateSessionId, hashSessionId } from "@/utils/auth/session"
import { deleteCachedSession, getCachedSession, setCachedSession } from "@/utils/auth/session-cache"

const SESSION_DURATION_DAYS = 30
const RENEW_THRESHOLD_MS = (1000 * 60 * 60 * 24 * SESSION_DURATION_DAYS) / 2

export const authService = {
  async register(email: string, password: string) {
    const user = await authRepository.findUserByEmail(email)

    if (user) {
      throw new AppError({ code: "user_already_exists" })
    }

    const passwordHash = await hashPassword(password)

    const newUser = await authRepository.createUser({
      email,
      passwordHash,
      status: "pending_approval",
      emailVerified: false
    })

    const verificationToken = generateSessionId()
    const tokenHash = hashSessionId(verificationToken)
    const expiresAt = createSessionExpiry({ hours: 24 })

    await authRepository.createVerificationToken({
      userId: newUser.id,
      token: tokenHash,
      type: "email_verification",
      expiresAt
    })

    appEvents.emit(EventTypes.USER_REGISTERED, {
      email: newUser.email,
      verificationToken
    })

    return newUser
  },

  async login(email: string, password: string) {
    const user = await authRepository.findUserByEmail(email)

    if (!user || !user.passwordHash) {
      throw new AppError({ code: "invalid_credentials" })
    }

    const valid = await verifyPassword(password, user.passwordHash)

    if (!valid) {
      throw new AppError({ code: "invalid_credentials" })
    }

    return { user }
  },

  async logout(sessionId: string) {
    const sessionHash = hashSessionId(sessionId)
    await authRepository.deleteSession(sessionHash)
    await deleteCachedSession(sessionHash)
  },

  async createSession(userId: string, ipAddress?: string, userAgent?: string) {
    const sessionId = generateSessionId()
    const sessionHash = hashSessionId(sessionId)
    const expiresAt = createSessionExpiry({ days: SESSION_DURATION_DAYS })

    await authRepository.createSession({
      id: sessionHash,
      userId,
      expiresAt,
      ipAddress,
      userAgent
    })

    return {
      sessionId,
      expiresAt
    }
  },

  async validateSession(sessionId: string) {
    const sessionHash = hashSessionId(sessionId)

    // first check cache
    const cached = await getCachedSession(sessionHash)
    if (cached) {
      return {
        userId: cached.userId,
        role: cached.role
      }
    }

    const session = await authRepository.findSessionWithUser(sessionHash)

    if (!session) return null

    const now = Date.now()
    const expires = session.expiresAt.getTime()

    if (expires < now) {
      await authRepository.deleteSession(sessionHash)
      return null
    }

    // sliding expiration
    if (expires - now < RENEW_THRESHOLD_MS) {
      const newExpiry = createSessionExpiry({ days: SESSION_DURATION_DAYS })
      await authRepository.updateSessionExpiry(sessionHash, newExpiry)
      session.expiresAt = newExpiry
    }

    // save caching
    await setCachedSession(sessionHash, {
      userId: session.userId,
      role: session.role,
      expiresAt: expires
    })

    return {
      userId: session.userId,
      role: session.role
    }
  },

  async verifyEmail(token: string) {
    const tokenHash = hashSessionId(token)
    const vt = await authRepository.findVerificationToken(tokenHash)

    if (!vt || vt.type !== "email_verification") {
      throw new AppError({ code: "invalid_or_expired_token" })
    }

    if (vt.expiresAt < new Date()) {
      await authRepository.deleteVerificationToken(tokenHash)
      throw new AppError({ code: "token_expired" })
    }

    await authRepository.verifyUserEmail(vt.userId)
    await authRepository.deleteVerificationToken(tokenHash)

    return { success: true }
  },

  async forgotPassword(email: string) {
    const user = await authRepository.findUserByEmail(email)

    if (!user) {
      return { success: true }
    }

    // Throttling: avoid requesting an email every 1 second
    const latestToken = await authRepository.findLatestVerificationToken(user.id, "password_reset")
    if (latestToken && Date.now() - latestToken.createdAt.getTime() < 60000) {
      throw new AppError({ code: "too_many_requests" })
    }

    const resetToken = generateSessionId()
    const tokenHash = hashSessionId(resetToken)
    const expiresAt = createSessionExpiry({ hours: 2 })

    // remove old tokens
    await authRepository.deleteVerificationTokensByUser(user.id, "password_reset")

    await authRepository.createVerificationToken({
      userId: user.id,
      token: tokenHash,
      type: "password_reset",
      expiresAt
    })

    appEvents.emit(EventTypes.PASSWORD_RESET_REQUESTED, {
      email: user.email,
      resetToken
    })

    return { success: true }
  },

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashSessionId(token)
    const vt = await authRepository.findVerificationToken(tokenHash)

    if (!vt || vt.type !== "password_reset") {
      throw new AppError({ code: "invalid_or_expired_token" })
    }

    if (vt.expiresAt < new Date()) {
      await authRepository.deleteVerificationToken(tokenHash)
      throw new AppError({ code: "token_expired" })
    }

    const passwordHash = await hashPassword(newPassword)
    await authRepository.updateUserPassword(vt.userId, passwordHash)

    // close all sessions
    await authRepository.deleteUserSessions(vt.userId)

    // remove tokens
    await authRepository.deleteVerificationTokensByUser(vt.userId, "password_reset")

    return { success: true }
  }
}
