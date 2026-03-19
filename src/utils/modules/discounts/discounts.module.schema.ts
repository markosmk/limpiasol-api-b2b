import * as v from "valibot"

export const discountsModuleConfigSchema = v.object({
  enabled: v.boolean(),
  config: v.object({
    defaultDiscountRate: v.pipe(
      v.number(),
      v.minValue(0, "El descuento debe ser mayor o igual a 0"),
      v.maxValue(100, "El descuento debe ser menor o igual a 100")
    ),
    applyToShipping: v.boolean(),
    taxExemptProvinces: v.optional(v.array(v.string()))
  })
})
