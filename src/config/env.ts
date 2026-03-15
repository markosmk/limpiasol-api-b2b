import * as v from "valibot"

const EnvSchema = v.object({
  APP_URL: v.pipe(v.string(), v.url()),
  PORT: v.number(),
  DATABASE_URL: v.string(),
  NODE_ENV: v.picklist(["development", "production", "test"]),
  REDIS_URL: v.optional(v.string()),
  BREVO_API_KEY: v.optional(v.string()),
  EMAIL_FROM: v.optional(v.pipe(v.string(), v.email()))
})

export const env = v.parse(EnvSchema, {
  APP_URL: process.env.APP_URL || "http://localhost:3000",
  PORT: Number(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  REDIS_URL: process.env.REDIS_URL,
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM
})
