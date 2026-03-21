import fp from "fastify-plugin"
import productsRoutes from "./products.routes"

export default fp(async (app) => {
  app.register(productsRoutes, { prefix: "/products" })
})
