import * as v from "valibot"

export const emailModuleConfigSchema = v.object({
  provider: v.union([v.literal("brevo"), v.literal("resend"), v.literal("smtp"), v.null_()]),
  credentials: v.object({
    apiKey: v.optional(v.string()),
    apiSecret: v.optional(v.string()),
    fromName: v.pipe(v.string(), v.minLength(2, "El nombre debe tener al menos 2 caracteres")),
    fromEmail: v.pipe(
      v.string("El email del remitente es obligatorio"),
      v.email("El formato del email no es válido")
    )
  }),
  templates: v.optional(v.record(v.string(), v.string())),
  templateIds: v.optional(v.record(v.string(), v.string()))
})

export type EmailConfigInput = v.InferOutput<typeof emailModuleConfigSchema>
