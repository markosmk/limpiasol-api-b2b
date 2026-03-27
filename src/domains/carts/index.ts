import fp from "fastify-plugin"
import cartsRoutes from "./carts.routes"

export default fp(async (app) => {
  app.register(cartsRoutes, { prefix: "/carts" })
})
