import fp from "fastify-plugin"
import { type BaseIssue, flatten } from "valibot"
import type { FastifyPluginAsync } from "fastify"

import { AppError } from "@/utils/app-error"

type IssuesValibot = [BaseIssue<unknown>, ...BaseIssue<unknown>[]]

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    // extract info safely
    const err = error as { statusCode?: number; message?: string; name?: string }
    const name = err.name

    // valibot: errors of validation data
    if (name === "ValiError") {
      // casting safely
      const flatIssues = flatten((error as { issues?: IssuesValibot }).issues as IssuesValibot)

      return reply.status(400).send({
        statusCode: 400,
        code: "validation_error",
        message: "Los datos enviados no son válidos",
        issues: flatIssues.nested
      })
    }

    // custom errors
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code, // for frontend to react
        message: error.message
      })
    }

    // errors controlled by Fastify plugins (Rate limit, Sensible, etc)
    const erorr = error as { statusCode?: number; message?: string; name?: string }
    if (erorr.statusCode && erorr.statusCode < 500) {
      let code = err.name ? err.name.toLowerCase().replace(/\s+/g, "_") : "client_error"

      // remove fastify from code
      if (code.includes("fastify")) {
        code = code.replace("fastify", "")
      }

      return reply.status(erorr.statusCode).send({
        statusCode: erorr.statusCode,
        code,
        message: erorr.message
      })
    }

    // use request.log to keep the request ID
    request.log.error(error)

    // fallback 500: uncontrolled errors (Ej: Drizzle errors)
    return reply.status(500).send({
      statusCode: 500,
      code: "internal_server_error",
      message: "Ha ocurrido un error interno en el servidor."
    })
  })
}

export default fp(errorHandlerPlugin)
