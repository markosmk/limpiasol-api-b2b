import rateLimit from "@fastify/rate-limit"
import fp from "fastify-plugin"
import type { RateLimitOptions } from "@fastify/rate-limit"

import redisClient from "@/config/redis-client"

// /**
//  * This plugins adds rate limiter for your routes.
//  *
//  * @see https://github.com/fastify/fastify-rate-limit
//  */
export default fp<RateLimitOptions>(
  async (
    fastify,
    opts = {
      max: 100,
      timeWindow: "1 minute"
    }
  ) => {
    await fastify.register(rateLimit, {
      max: opts.max || 100,
      timeWindow: opts.timeWindow || "1 minute",
      redis: redisClient || undefined,
      errorResponseBuilder: (_request, context) => ({
        statusCode: 429,
        error: "Too Many Requests",
        message: `Has excedido el límite de peticiones. Intenta de nuevo en ${context.after}`
      })
    })
  }
)
