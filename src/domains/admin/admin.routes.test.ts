import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { createTestUserAndSession } from "#test/utils/auth-helpers"
import { createTestApp } from "#test/utils/test-app"
import { db, setupTestDB, teardownTestDB } from "#test/utils/test-db"
import adminRoutes from "./admin.routes"
import type { FastifyInstance } from "fastify"

import { settings } from "@/db/schema/settings"
import { appEvents, EventTypes } from "@/events/emitter"

// Mockeamos la encriptación para asertar sin depender de variables de entorno
vi.mock("@/utils/crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/crypto")>()
  return {
    ...actual,
    encryptToBase64: vi.fn((val) => `encrypted_${val}`)
  }
})

describe("Admin Domain - Rutas de Configuración", () => {
  let app: FastifyInstance
  let adminSessionId: string
  let customerSessionId: string
  let cleanupSessions: (() => Promise<void>) | null = null

  beforeAll(async () => {
    await setupTestDB()
    app = await createTestApp(adminRoutes, "/admin")
    await app.ready()
  })

  afterAll(async () => {
    if (cleanupSessions) await cleanupSessions()
    await app.close()
    await teardownTestDB()
  })

  beforeEach(async () => {
    // Limpiamos la tabla de settings antes de cada test
    await db.delete(settings).execute()
    vi.clearAllMocks()

    // Setup de usuarios si no existen
    if (!adminSessionId) {
      const adminAuth = await createTestUserAndSession("admin")
      const customerAuth = await createTestUserAndSession("user")
      adminSessionId = adminAuth.sessionId
      customerSessionId = customerAuth.sessionId

      cleanupSessions = async () => {
        await adminAuth.cleanup()
        await customerAuth.cleanup()
      }
    }
  })

  // ─────────────────────────────────────────
  // Tests de Settings Generales
  // ─────────────────────────────────────────
  describe("PATCH & GET /admin/settings", () => {
    it("Debe guardar un setting y devolverlo correctamente agrupado", async () => {
      // Act 1: Guardar un setting de la tienda
      const patchRes = await app.inject({
        method: "PATCH",
        url: "/admin/settings",
        payload: {
          key: "storeName",
          value: "Mi Tienda B2B",
          category: "store"
        },
        cookies: { session: adminSessionId }
      })

      expect(patchRes.statusCode).toBe(200)

      // Act 2: Recuperar todos los settings de esa categoría
      const getRes = await app.inject({
        method: "GET",
        url: "/admin/settings?category=store",
        cookies: { session: adminSessionId }
      })

      expect(getRes.statusCode).toBe(200)
      const body = getRes.json()
      expect(body).toEqual({
        storeName: "Mi Tienda B2B"
      })
    })

    it("Debe denegar el acceso a un usuario no admin (401/403)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/settings",
        cookies: { session: customerSessionId } // Usuario normal
      })

      expect(res.statusCode).toBeGreaterThanOrEqual(401)
    })
  })

  // ─────────────────────────────────────────
  // Tests de Configuración de Módulos
  // ─────────────────────────────────────────
  describe("PATCH & GET /admin/modules/:name", () => {
    it("Debe guardar la config de un módulo y ENCRIPTAR la API Key si es el módulo 'email'", async () => {
      const emailConfigPayload = {
        enabled: true,
        config: {
          provider: "brevo",
          credentials: {
            apiKey: "clave_secreta_123",
            fromName: "Ventas",
            fromEmail: "ventas@tienda.com"
          }
        }
      }

      // Act: Guardar config del módulo
      const patchRes = await app.inject({
        method: "PATCH",
        url: "/admin/modules/email",
        payload: emailConfigPayload,
        cookies: { session: adminSessionId }
      })

      expect(patchRes.statusCode, `Fallo el PATCH: ${patchRes.payload}`).toBe(200)

      // Assert BD: Verificamos que se haya encriptado
      const dbSetting = await db.query.settings.findFirst({
        where: eq(settings.key, "modules:email")
      })

      // biome-ignore lint/suspicious/noExplicitAny: <explanation >
      const savedValue = dbSetting?.value as any
      expect(savedValue.enabled).toBe(true)
      expect(savedValue.config.credentials.fromName).toBe("Ventas")

      // La API key original no debe existir, debe estar la encriptada
      expect(savedValue.config.credentials.apiKey).toBeUndefined()
      expect(savedValue.config.credentials.apiKeyEncrypted).toBe("encrypted_clave_secreta_123")
    })

    it("Debe devolver error de validación si la config del módulo es incorrecta", async () => {
      const badPayload = {
        enabled: true,
        config: {
          provider: "brevo",
          credentials: {
            fromName: "V", // Falla porque Valibot exige minLength(2)
            fromEmail: "correo-invalido" // Falla validación de email
          }
        }
      }

      const patchRes = await app.inject({
        method: "PATCH",
        url: "/admin/modules/email",
        payload: badPayload,
        cookies: { session: adminSessionId }
      })

      // Dependiendo de cómo lances el AppError, debería ser 400
      expect(patchRes.statusCode).toBe(400)
      const body = patchRes.json()
      expect(body.code).toBe("VALIDATION_ERROR")
    })
  })

  describe("EVENTS ", () => {
    it("Debe guardar la config y emitir el evento de actualización", async () => {
      // 1. Ponemos un "espía" en la función emit
      const emitSpy = vi.spyOn(appEvents, "emit")

      // 2. Hacemos la petición
      const patchRes = await app.inject({
        method: "PATCH",
        url: "/admin/modules/email", // Usamos uno simple sin encriptación para probar el flujo base
        payload: {
          enabled: true,
          config: {
            provider: "brevo",
            credentials: {
              fromName: "Ventas",
              fromEmail: "test@ventas.com"
            }
          }
        },
        cookies: { session: adminSessionId }
      })
      expect(patchRes.statusCode, `Fallo el PATCH: ${patchRes.payload}`).toBe(200)

      // 3. Verificamos que se haya emitido el evento EXACTO
      expect(emitSpy).toHaveBeenCalledTimes(1)
      expect(emitSpy).toHaveBeenCalledWith(EventTypes.MODULE_CONFIG_UPDATED, "email")

      // Limpiamos el espía
      emitSpy.mockRestore()
    })
  })
})
