import { usersRepository } from "./users.repository"
import type { ListUsersInput, UpdateRoleInput, UpdateStatusInput } from "./users.schema"

import { AppError } from "@/utils/app-error"

export const usersService = {
  async listUsers(filters: ListUsersInput) {
    return await usersRepository.list(filters)
  },

  async getUser(id: string) {
    const user = await usersRepository.findById(id)
    if (!user) {
      throw new AppError({ code: "user_not_found" })
    }
    return user
  },

  async updateStatus(id: string, data: UpdateStatusInput) {
    const user = await usersRepository.findById(id)
    if (!user) {
      throw new AppError({ code: "user_not_found" })
    }
    if (user.status === data.status) return

    await usersRepository.updateStatus(id, data)
  },

  async updateRole(id: string, data: UpdateRoleInput) {
    const user = await usersRepository.findById(id)
    if (!user) {
      throw new AppError({ code: "user_not_found" })
    }

    await usersRepository.updateRole(id, data)
  },

  async deleteUser(id: string) {
    const user = await usersRepository.findById(id)
    if (!user) {
      throw new AppError({ code: "user_not_found" })
    }

    await usersRepository.delete(id)
  }
}
