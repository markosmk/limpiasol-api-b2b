import * as v from "valibot"

export const shippingModuleConfigSchema = v.object({
  enabled: v.boolean(),
  config: v.object({
    defaultCost: v.pipe(v.number(), v.minValue(0, "El costo debe ser mayor o igual a 0")),
    freeShippingThreshold: v.optional(
      v.pipe(v.number(), v.minValue(0, "El umbral debe ser mayor o igual a 0"))
    ),
    postalCodeRules: v.optional(
      v.array(
        v.object({
          pattern: v.string(),
          cost: v.pipe(v.number(), v.minValue(0, "El costo debe ser mayor o igual a 0")),
          label: v.optional(v.string())
        })
      )
    ),
    disabledProvinces: v.optional(v.array(v.string()))
  })
})
