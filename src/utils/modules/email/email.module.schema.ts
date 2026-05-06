import * as v from "valibot"

const baseFields = {
  templates: v.optional(v.record(v.string(), v.string())),
  templateIds: v.optional(v.record(v.string(), v.string()))
}

const baseCredentials = {
  fromName: v.pipe(v.string(), v.minLength(2, "El nombre debe tener al menos 2 caracteres")),
  fromEmail: v.pipe(
    v.string("El email del remitente es obligatorio"),
    v.email("El formato del email no es válido")
  )
}

export const emailModuleConfigSchema = v.variant("provider", [
  v.object({
    provider: v.literal("brevo"),
    credentials: v.object({
      ...baseCredentials,
      apiKey: v.pipe(v.string(), v.nonEmpty("API Key requerida para Brevo"))
    }),
    ...baseFields
  }),
  v.object({
    provider: v.literal("resend"),
    credentials: v.object({
      ...baseCredentials,
      apiKey: v.pipe(v.string(), v.nonEmpty("API Key requerida para Resend"))
    }),
    ...baseFields
  }),
  v.object({
    provider: v.literal("ses"),
    credentials: v.object({
      ...baseCredentials,
      awsRegion: v.pipe(v.string(), v.nonEmpty("Región AWS requerida")),
      apiKey: v.pipe(v.string(), v.nonEmpty("Access Key ID requerido para SES")),
      apiSecret: v.pipe(v.string(), v.nonEmpty("Secret Access Key requerido para SES"))
    }),
    ...baseFields
  }),
  v.object({
    provider: v.literal("smtp"),
    credentials: v.object({
      ...baseCredentials,
      smtpHost: v.pipe(v.string(), v.nonEmpty("Host SMTP requerido")),
      smtpPort: v.number("Puerto SMTP requerido"),
      smtpSecure: v.optional(v.boolean()),
      smtpUser: v.pipe(v.string(), v.nonEmpty("Usuario SMTP requerido")),
      smtpPass: v.pipe(v.string(), v.nonEmpty("Contraseña SMTP requerida"))
    }),
    ...baseFields
  }),
  v.object({
    provider: v.literal("console"),
    credentials: v.optional(
      v.object({
        fromName: v.optional(v.string()),
        fromEmail: v.optional(v.string())
      })
    ),
    ...baseFields
  }),
  v.object({
    provider: v.null_(),
    credentials: v.optional(
      v.object({
        fromName: v.optional(v.string()),
        fromEmail: v.optional(v.string())
      })
    ),
    ...baseFields
  })
])

export type EmailConfigInput = v.InferOutput<typeof emailModuleConfigSchema>
