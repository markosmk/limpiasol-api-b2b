import * as v from "valibot"
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} from "./auth.schema"
import { authService } from "./auth.service"
import type { FastifyInstance } from "fastify"

import redisClient from "@/config/redis-client"
import { AppError } from "@/utils/app-error"

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const body = v.parse(loginSchema, request.body)

      const { user } = await authService.login(body.email, body.password)

      if (user.status !== "active") {
        throw new AppError({ code: "account_inactive" })
      }

      const session = await authService.createSession(
        user.id,
        request.ip,
        request.headers["user-agent"]
      )

      reply.setCookie("session", session.sessionId, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // true,
        sameSite: "lax",
        expires: session.expiresAt
      })

      return { user }
    }
  )

  app.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour"
        }
      }
    },
    async (request, reply) => {
      const body = v.parse(registerSchema, request.body)

      const user = await authService.register(body.email, body.password)

      return reply.code(201).send({
        message: "Usuario registrado. Revisa tu email para verificar la cuenta.",
        userId: user.id
      })
    }
  )

  app.get("/verify-email", async (request) => {
    const { token } = request.query as { token?: string }

    if (!token) {
      throw new AppError({ code: "invalid_or_expired_token" })
    }

    await authService.verifyEmail(token)

    return { success: true, message: "Email verificado correctamente" }
  })

  app.post("/logout", async (request, reply) => {
    const sessionId = request.cookies.session
    if (sessionId) {
      await authService.logout(sessionId)
    }
    reply.clearCookie("session", {
      path: "/"
    })
    return { success: true }
  })

  app.post(
    "/forgot-password",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour"
        }
      }
    },
    async (request) => {
      const body = v.parse(forgotPasswordSchema, request.body)
      await authService.forgotPassword(body.email)
      return {
        success: true,
        message: "Si el email existe, se ha enviado un enlace de recuperación."
      }
    }
  )

  app.post("/reset-password", async (request) => {
    const body = v.parse(resetPasswordSchema, request.body)
    await authService.resetPassword(body.token, body.password)
    return { success: true, message: "Contraseña actualizada correctamente." }
  })

  // Dev function
  // TODO: remove in production
  app.get("/getAllRecords", async (_request, reply) => {
    if (!redisClient) {
      return reply.notFound("Redis is not enabled")
    }
    try {
      const keys = await redisClient.keys("*")
      if (keys.length === 0) return {}

      const values = await redisClient.mget(...keys)
      const records = keys.reduce((result: Record<string, string | null>, key, index) => {
        result[key] = values[index]
        return result
      }, {})
      return records
    } catch (_err) {
      return reply.internalServerError("Error fetching Redis records")
    }
  })
}
