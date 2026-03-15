import fp from "fastify-plugin"
import authRoutes from "./auth.routes"

export default fp(async (app) => {
  app.register(authRoutes, { prefix: "/auth" })
})
