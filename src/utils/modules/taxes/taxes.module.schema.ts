import * as v from "valibot"

export const taxesModuleConfigSchema = v.object({
  enabled: v.boolean(),
  config: v.object({
    defaultRate: v.pipe(
      v.number(),
      v.minValue(0, "La tasa mínima es 0"),
      v.maxValue(1, "La tasa máxima es 100% (1.0)")
    ),
    provincialRates: v.optional(
      v.array(
        v.object({
          province: v.pipe(v.string(), v.nonEmpty("Provincia requerida")),
          rate: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
          concept: v.optional(v.string()),
          description: v.optional(v.string())
        })
      )
    ),
    exemptCategories: v.optional(v.array(v.string())),
    minTaxableAmount: v.optional(v.pipe(v.number(), v.minValue(0, "No puede ser negativo"))),
    taxesIncludedInPrice: v.optional(v.boolean())
  })
})

export type TaxesModuleConfigInput = v.InferOutput<typeof taxesModuleConfigSchema>
