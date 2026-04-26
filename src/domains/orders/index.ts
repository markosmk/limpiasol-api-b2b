import fp from "fastify-plugin"
import ordersRoutes from "./orders.routes"

export default fp(async (app) => {
  app.register(ordersRoutes, { prefix: "/" })
})
