import { analyticsModuleConfigSchema } from "./analytics/analytics.module.schema"
import { discountsModuleConfigSchema } from "./discounts/discounts.module.schema"
import { emailModuleConfigSchema } from "./email/email.module.schema"
import { shippingModuleConfigSchema } from "./shipping/shipping.module.schema"
import { taxesModuleConfigSchema } from "./taxes/taxes.module.schema"
import type * as v from "valibot"

/**
 * Mapa de schemas por módulo
 * Permite validar dinámicamente según el moduleName
 */
export const moduleConfigSchemas = {
  taxes: taxesModuleConfigSchema,
  shipping: shippingModuleConfigSchema,
  discounts: discountsModuleConfigSchema,
  email: emailModuleConfigSchema,
  analytics: analyticsModuleConfigSchema
} as const

/**
 * Tipos inferidos de cada schema
 */
export type ModuleConfigSchemas = {
  taxes: typeof taxesModuleConfigSchema
  shipping: typeof shippingModuleConfigSchema
  discounts: typeof discountsModuleConfigSchema
  email: typeof emailModuleConfigSchema
  analytics: typeof analyticsModuleConfigSchema
}

/**
 * Helper para obtener el tipo de config de un módulo
 */
export type ModuleConfigInput<T extends keyof ModuleConfigSchemas> = v.InferOutput<
  ModuleConfigSchemas[T]
>
