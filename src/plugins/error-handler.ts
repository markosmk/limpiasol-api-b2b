import fp from "fastify-plugin"
import { type BaseIssue, flatten } from "valibot"
import type { FastifyPluginAsync } from "fastify"

import { AppError } from "@/utils/app-error"

type IssuesValibot = [BaseIssue<unknown>, ...BaseIssue<unknown>[]]
type GlobalError = {
  statusCode?: number
  message?: string
  name?: string
  code?: string
  // for routes {schema: {body: ...}}
  validation?: IssuesValibot
  // ej: "params", "body", "query"
  validationContext?: string
  issues?: IssuesValibot
}

/** return nested issues with custom messages for undefined keys */
function parserValibotIssues(issues: IssuesValibot) {
  const flatIssues = flatten(issues)
  const formattedIssues = flatIssues.nested

  if (!formattedIssues) return formattedIssues

  for (const key in formattedIssues) {
    const messages = formattedIssues[key]
    if (!messages || messages.length === 0) continue
    const firstMessage = messages[0]
    if (firstMessage?.includes("but received undefined") && firstMessage?.includes("Invalid key")) {
      const fieldName = key.split(".").pop()
      messages[0] = `El campo '${fieldName}' es obligatorio.`
    }
  }

  return formattedIssues
}

const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    // extract info safely
    const err = error as GlobalError
    const name = err.name

    // 1. Errores de Validación (Fastify Plugin o Valibot directo)
    if (err.code === "FST_ERR_VALIDATION" || name === "ValiError") {
      // Fastify guarda los issues en 'validation', v.parse los guarda en 'issues'
      const rawIssues = err.validation || err.issues
      if (rawIssues) {
        const flatIssues = parserValibotIssues(rawIssues as IssuesValibot)
        return reply.status(400).send({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son válidos",
          issues: flatIssues
        })
      }
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
