import fp from "fastify-plugin"
import accountRoutes from "./account.routes"

export default fp(async (app) => {
  app.register(accountRoutes, { prefix: "/account" })
})
