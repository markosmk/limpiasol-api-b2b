/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import fp from "fastify-plugin"
import { safeParse } from "valibot"
import type { FastifyPluginAsync } from "fastify"

/**
 * Plugin to use Valibot as validation engine in Fastify.
 * Allows using Valibot schemas directly in the `schema` object of the routes.
 */
const valibotPlugin: FastifyPluginAsync = async (app) => {
  app.setValidatorCompiler(({ schema }) => {
    return (data) => {
      const result = safeParse(schema as any, data)
      if (result.success) {
        return { value: result.output }
      }
      // errorHandler format issues
      return { error: result.issues as any }
    }
  })

  // Serializer compiler for responses to be validated/filtered
  // app.setSerializerCompiler(({ schema }) => {
  //   return (data) => {
  //     // Try to parse to clean the response according to the schema
  //     const result = safeParse(schema as any, data)
  //     return JSON.stringify(result.success ? result.output : data)
  //   }
  // })
}

export default fp(valibotPlugin)
