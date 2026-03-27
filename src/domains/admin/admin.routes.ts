import * as v from "valibot"
import { baseUpdateModuleSchema, moduleParamsSchema, updateSettingsSchema } from "./admin.schema"
import { adminService } from "./admin.service"
import type { FastifyInstance } from "fastify"

import { requireAuth } from "@/middlewares/require-auth"
import { requireRole } from "@/middlewares/require-role"
import { type ModuleName, moduleDefinitions } from "@/utils/modules/module-schemas"

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth)
  app.addHook("preHandler", requireRole(["admin"]))

  app.get("/settings", async (request) => {
    const { category } = request.query as { category?: string }
    return await adminService.getAllSettings(category)
  })

  app.patch("/settings", async (request) => {
    const body = v.parse(updateSettingsSchema, request.body)
    await adminService.updateSetting(body)
    return { success: true, message: "Configuración actualizada correctamente" }
  })

  // ─────────────────────────────────────────────────────────
  // Module Management Routes
  // ─────────────────────────────────────────────────────────

  app.get("/modules", async () => {
    const modules = await adminService.listModules()
    return { success: true, modules }
  })

  app.get(
    "/modules/:name",
    {
      schema: { params: moduleParamsSchema }
    },
    async (request) => {
      const { name } = request.params as { name: ModuleName }
      const config = await adminService.getModule(name)
      return { success: true, config }
    }
  )

  app.patch(
    "/modules/:name",
    {
      schema: {
        params: moduleParamsSchema,
        body: baseUpdateModuleSchema
      }
    },
    async (request, reply) => {
      const { name } = request.params as { name: ModuleName }
      const body = request.body as { enabled: boolean; config?: unknown }

      const moduleDef = moduleDefinitions[name]
      if (!moduleDef) {
        throw new Error(`Módulo "${name}" no encontrado`)
      }

      // biome-ignore lint/suspicious/noExplicitAny: <explanation >
      let finalConfig = v.parse(moduleDef.schema, body.config ?? {}) as any

      if (moduleDef.onBeforeSave) {
        finalConfig = moduleDef.onBeforeSave(finalConfig)
      }

      const finalDataToSave = {
        enabled: body.enabled,
        config: finalConfig
      }

      const updated = await adminService.updateModuleConfig(name, finalDataToSave)
      return reply.send({ success: true, data: updated })
    }
  )
}
