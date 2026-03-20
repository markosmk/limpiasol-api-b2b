import fp from "fastify-plugin"
import categoriesRoutes from "./categories.routes"

export default fp(async (app) => {
  app.register(categoriesRoutes, { prefix: "/categories" })
})
