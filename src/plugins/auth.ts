import fp from "fastify-plugin"

/**
 * Only initialize request.user in null for each request.
 * The session validation is done exclusively by the requireAuth middleware
 * in the routes that need it, avoiding unnecessary queries in public routes.
 */
export default fp(async (app) => {
  app.decorateRequest("user", null)
})
