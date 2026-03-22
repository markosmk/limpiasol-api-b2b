import cookie from "@fastify/cookie"
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from "fastify"

export async function createTestApp(
  routerPlugin?: FastifyPluginAsync,
  prefix: string = "/"
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  // register plugins as used in production
  await app.register(cookie)
  await app.register(import("@fastify/sensible"))
  await app.register(import("@fastify/cors"), { origin: "*" })

  if (routerPlugin) {
    await app.register(routerPlugin, { prefix })
  }

  // Hook to close DB on finish
  app.addHook("onClose", async () => {
    // close DB connection if using pool
  })

  // Hook to log errors in tests
  app.setErrorHandler((error, request, reply) => {
    const err = error as unknown as { statusCode?: number; message?: string }
    const statusCode = err.statusCode || 500
    if (statusCode === 500) {
      request.log.error(error)
    }
    reply.code(statusCode).send({
      success: false,
      error: err.message,
      statusCode
    })
  })

  return app
}
