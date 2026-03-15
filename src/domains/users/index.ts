import fp from "fastify-plugin"
import usersRoutes from "./users.routes"

export default fp(async (app) => {
  app.register(usersRoutes, { prefix: "/users" })
})
