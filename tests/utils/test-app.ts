import cookie from "@fastify/cookie"
import Fastify, { type FastifyInstance } from "fastify"

import productsRoutes from "@/domains/products/products.routes"

export async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  // register plugins as used in production
  await app.register(cookie)
  await app.register(import("@fastify/cors"), { origin: "*" })

  // register routes with prefix for tests
  await app.register(productsRoutes, { prefix: "/products" })

  // Hook to close DB on finish
  app.addHook("onClose", async () => {
    // close DB connection if using pool
  })

  // Hook to log errors in tests
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    reply.code(500).send({ error: "Internal server error" })
  })

  return app
}
