import * as v from "valibot"

export const emailModuleConfigSchema = v.object({
  enabled: v.boolean(),
  config: v.object({
    provider: v.union([v.literal("brevo"), v.literal("resend"), v.literal("smtp"), v.null_()]),
    credentials: v.object({
      apiKey: v.optional(v.string()),
      fromName: v.pipe(v.string(), v.minLength(2, "El nombre debe tener al menos 2 caracteres")),
      fromEmail: v.pipe(v.string(), v.email("El email debe ser válido"))
    }),
    templates: v.optional(
      v.object({
        orderCreated: v.optional(v.string()),
        orderPendingPayment: v.optional(v.string()),
        orderPaid: v.optional(v.string()),
        orderDispatched: v.optional(v.string()),
        orderCancelled: v.optional(v.string()),
        userRegistered: v.optional(v.string()),
        passwordReset: v.optional(v.string()),
        welcome: v.optional(v.string())
      })
    ),
    templateIds: v.optional(
      v.object({
        orderCreated: v.optional(v.string()),
        orderPendingPayment: v.optional(v.string()),
        orderPaid: v.optional(v.string()),
        orderDispatched: v.optional(v.string()),
        orderCancelled: v.optional(v.string()),
        userRegistered: v.optional(v.string()),
        passwordReset: v.optional(v.string()),
        welcome: v.optional(v.string())
      })
    )
  })
})
