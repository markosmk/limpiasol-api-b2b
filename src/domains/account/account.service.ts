import type { UpdateMeInput } from "@/domains/account/account.schema"

import { accountRepository } from "@/domains/account/account.repository"
import { authRepository } from "@/domains/auth/auth.repository"
import { AppError } from "@/utils/app-error"
import { hashPassword, verifyPassword } from "@/utils/auth/hash"
import { hashSessionId } from "@/utils/auth/session"
import { deleteCachedSession } from "@/utils/auth/session-cache"

export const accountService = {
  async getMe(userId: string) {
    const user = await accountRepository.findUserById(userId)
    if (!user) {
      throw new AppError({ code: "user_not_found" })
    }
    return user
  },

  async updateMe(userId: string, data: UpdateMeInput) {
    await accountRepository.updateUser(userId, data)
    return await this.getMe(userId)
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await authRepository.findUserById(userId)
    if (!user?.passwordHash) {
      throw new AppError({ code: "user_not_found" })
    }

    const isValid = await verifyPassword(oldPassword, user.passwordHash)
    if (!isValid) {
      throw new AppError({ code: "invalid_credentials" })
    }

    const newPasswordHash = await hashPassword(newPassword)
    await authRepository.updateUserPassword(userId, newPasswordHash)
    // close all sesions for security
    await accountRepository.revokeAllSessions(userId)
  },

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await accountRepository.listUserSessions(userId)
    const currentHash = currentSessionId ? hashSessionId(currentSessionId) : null

    return sessions.map((s) => ({
      ...s,
      isCurrent: s.id === currentHash
    }))
  },

  async revokeSession(userId: string, sessionId: string) {
    const sessionHash = hashSessionId(sessionId)
    await accountRepository.revokeSession(userId, sessionHash)
    await deleteCachedSession(sessionHash)
  },

  async revokeAllSessions(userId: string, exceptCurrentId?: string) {
    const exceptHash = exceptCurrentId ? hashSessionId(exceptCurrentId) : undefined
    await accountRepository.revokeAllSessions(userId, exceptHash)
  }
}
