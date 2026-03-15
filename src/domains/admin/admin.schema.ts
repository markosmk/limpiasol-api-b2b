import * as v from "valibot"

export const updateSettingsSchema = v.object({
  key: v.pipe(v.string(), v.nonEmpty()),
  value: v.unknown(),
  category: v.optional(v.string())
})

export type UpdateSettingsInput = v.InferOutput<typeof updateSettingsSchema>
