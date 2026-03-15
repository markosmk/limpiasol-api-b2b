import * as v from "valibot"
import { accountService } from "../account/account.service"
import { updateSettingsSchema } from "./admin.schema"
import { adminService } from "./admin.service"
import type { FastifyInstance } from "fastify"

import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)
  app.addHook("preHandler", requireRole(["admin"]))

  app.get("/me", async (request) => {
    return await accountService.getMe(request.user!.id)
  })

  app.get("/settings", async (request) => {
    const { category } = request.query as { category?: string }
    return await adminService.getAllSettings(category)
  })

  app.patch("/settings", async (request) => {
    const body = v.parse(updateSettingsSchema, request.body)
    await adminService.updateSetting(body)
    return { success: true, message: "Configuración actualizada correctamente" }
  })
}
