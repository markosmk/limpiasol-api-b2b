import * as v from "valibot"

export const analyticsModuleConfigSchema = v.object({
  provider: v.union([
    v.literal("google"),
    v.literal("plausible"),
    v.literal("umami"),
    v.literal("custom")
  ]),
  trackingId: v.optional(v.string()),
  domain: v.optional(v.string()),
  excludeLoggedInUsers: v.optional(v.boolean()),
  respectDoNotTrack: v.optional(v.boolean()),
  customEvents: v.optional(
    v.array(
      v.object({
        name: v.string(),
        category: v.optional(v.string()),
        label: v.optional(v.string())
      })
    )
  ),
  googleConfig: v.optional(
    v.object({
      measurementId: v.string(),
      gtagScript: v.optional(v.string()),
      anonymizeIp: v.optional(v.boolean()),
      sendPageView: v.optional(v.boolean())
    })
  ),
  plausibleConfig: v.optional(
    v.object({
      domain: v.string(),
      scriptUrl: v.optional(v.string()),
      apiEndpoint: v.optional(v.string())
    })
  )
})

export type AnalyticsConfigInput = v.InferOutput<typeof analyticsModuleConfigSchema>
