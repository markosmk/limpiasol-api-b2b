import fp from "fastify-plugin"
import collectionsRoutes from "./collections.routes"

export default fp(async (app) => {
  app.register(collectionsRoutes, { prefix: "/collections" })
})
