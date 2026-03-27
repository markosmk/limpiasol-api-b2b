import { encryptToBase64 } from "../crypto"
import {
  type AnalyticsConfigInput,
  analyticsModuleConfigSchema
} from "./analytics/analytics.module.schema"
import {
  type DiscountsConfigInput,
  discountsModuleConfigSchema
} from "./discounts/discounts.module.schema"
import { type EmailConfigInput, emailModuleConfigSchema } from "./email/email.module.schema"
import {
  type ShippingConfigInput,
  shippingModuleConfigSchema
} from "./shipping/shipping.module.schema"
import { type TaxesConfigInput, taxesModuleConfigSchema } from "./taxes/taxes.module.schema"
import type * as v from "valibot"
import type { AnalyticsModuleConfig } from "./analytics/analytics.module.types"
import type { DiscountsModuleConfig } from "./discounts/discounts.module.types"
import type { EmailModuleConfig } from "./email/email.module.types"
import type { ShippingModuleConfig } from "./shipping/shipping.module.types"
import type { TaxesModuleConfig } from "./taxes/taxes.module.types"

export const moduleNames = ["email", "analytics", "shipping", "taxes", "discounts"] as const
export type ModuleName = (typeof moduleNames)[number]

export interface ModuleDefinition<TInput = unknown, TStorage = unknown> {
  schema: v.BaseSchema<unknown, TInput, v.BaseIssue<unknown>>
  // Hook opcional para mutar/encriptar datos antes de guardarlos en DB
  onBeforeSave?: (configInput: TInput) => TStorage
}

type ModuleDefinitionInput = {
  email: ModuleDefinition<EmailConfigInput, EmailModuleConfig>
  analytics: ModuleDefinition<AnalyticsConfigInput, AnalyticsModuleConfig>
  shipping: ModuleDefinition<ShippingConfigInput, ShippingModuleConfig>
  taxes: ModuleDefinition<TaxesConfigInput, TaxesModuleConfig>
  discounts: ModuleDefinition<DiscountsConfigInput, DiscountsModuleConfig>
}

export const moduleDefinitions: ModuleDefinitionInput = {
  email: {
    schema: emailModuleConfigSchema,
    onBeforeSave: (input) => {
      const { apiKey, apiSecret, ...safeCredentials } = input.credentials

      const storageConfig: EmailModuleConfig = {
        ...input,
        credentials: safeCredentials
      }

      if (apiKey) storageConfig.credentials.apiKeyEncrypted = encryptToBase64(apiKey)
      if (apiSecret) storageConfig.credentials.apiSecretEncrypted = encryptToBase64(apiSecret)

      return storageConfig
    }
  },
  analytics: {
    schema: analyticsModuleConfigSchema,
    onBeforeSave: (input) => {
      const { trackingId, ...rest } = input

      const storageConfig: AnalyticsModuleConfig = { ...rest }
      if (trackingId) {
        storageConfig.trackingIdEncrypted = encryptToBase64(trackingId)
      }
      return storageConfig
    }
  },
  shipping: { schema: shippingModuleConfigSchema },
  taxes: { schema: taxesModuleConfigSchema },
  discounts: { schema: discountsModuleConfigSchema }
}
