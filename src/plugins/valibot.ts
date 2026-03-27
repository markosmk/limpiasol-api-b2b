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
  app.setSerializerCompiler(({ schema }) => {
    return (data) => {
      const result = safeParse(schema as any, data)
      if (result.success) {
        return JSON.stringify(result.output)
      }

      // if response doesn't match the schema, log the error and return the raw data
      console.warn(
        "⚠️ [Valibot Serializer] La respuesta no coincide con el schema definido:",
        result.issues
      )
      return JSON.stringify(data)
    }
  })
}

export default fp(valibotPlugin)
