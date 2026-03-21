import { httpErrors } from "@fastify/sensible"
import * as v from "valibot"
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from "fastify"

// biome-ignore lint/suspicious/noExplicitAny: <explanation >
export function validateRequest<T extends v.BaseSchema<any, any, any>>(
  schema: T,
  part: "body" | "query" | "params" = "body"
) {
  return (request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) => {
    try {
      const parsed = v.parse(schema, request[part])
      if (part === "params" && typeof request.params === "object") {
        const currentParams = request.params
        request.params = { ...currentParams, ...parsed }
      } else {
        request[part] = parsed
      }

      done()
    } catch (error) {
      if (error instanceof v.ValiError) {
        let flattenedErrors = v.flatten(error.issues).nested as Record<string, string[]>
        console.error(`Validation Error (${part}):`, flattenedErrors)

        flattenedErrors = Object.keys(flattenedErrors).reduce(
          (acc, key) => {
            acc[key] = flattenedErrors[key].map((message) => {
              if (
                message.startsWith("Invalid key: Expected") &&
                message.endsWith("but received undefined")
              ) {
                return `${key} es requerido.`
              }
              return message
            })
            return acc
          },
          {} as Record<string, string[]>
        )

        reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: `Datos inválidos en la solicitud (${part}).`,
          validation: flattenedErrors
        })
        // done(error);
      } else {
        console.error(`Unexpected error during validation (${part}):`, error)
        reply.code(500).send({
          statusCode: 500,
          error: "Internal Server Error",
          message: "Error inesperado durante la validación."
        })
        // done(new Error("Unexpected validation error"));
      }
    }
  }
}

export function validateBody(
  request: FastifyRequest<{ Body: Record<string, unknown> }>,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  if (!request.body || Object.keys(request.body).length === 0) {
    reply.status(400).send(httpErrors.badRequest("El cuerpo de la solicitud no puede estar vacío."))
    done()
    return
  }
  done()
}
