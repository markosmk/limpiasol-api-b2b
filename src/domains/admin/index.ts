import fp from "fastify-plugin"
import adminRoutes from "./admin.routes"

export default fp(async (app) => {
  app.register(adminRoutes, { prefix: "/admin" })
})
