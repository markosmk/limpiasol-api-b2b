import * as v from "valibot"

export const analyticsModuleConfigSchema = v.object({
  enabled: v.boolean(),
  config: v.object({
    provider: v.union([v.literal("google-analytics"), v.literal("plausible"), v.literal("custom")]),
    trackingId: v.optional(v.string()),
    customEndpoint: v.optional(v.string())
  })
})
