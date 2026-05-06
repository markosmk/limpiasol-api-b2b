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
      const storageConfig: EmailModuleConfig = {
        provider: input.provider,
        templates: input.templates,
        templateIds: input.templateIds,
        credentials: {
          fromName: input.credentials?.fromName || "", // || "LimpiaSol"
          fromEmail: input.credentials?.fromEmail || "" // || "no-reply@limpiasol.com"
        }
      }

      if (input.credentials) {
        if ("apiKey" in input.credentials && input.credentials.apiKey) {
          storageConfig.credentials.apiKeyEncrypted = encryptToBase64(input.credentials.apiKey)
        }
        if ("apiSecret" in input.credentials && input.credentials.apiSecret) {
          storageConfig.credentials.apiSecretEncrypted = encryptToBase64(
            input.credentials.apiSecret
          )
        }
        if ("awsRegion" in input.credentials && input.credentials.awsRegion) {
          storageConfig.credentials.awsRegion = input.credentials.awsRegion
        }
        if ("smtpHost" in input.credentials && input.credentials.smtpHost) {
          storageConfig.credentials.smtpHost = input.credentials.smtpHost
          storageConfig.credentials.smtpPort = input.credentials.smtpPort
          storageConfig.credentials.smtpSecure = input.credentials.smtpSecure
          if ("smtpUser" in input.credentials && input.credentials.smtpUser) {
            storageConfig.credentials.smtpUserEncrypted = encryptToBase64(
              input.credentials.smtpUser
            )
          }
          if ("smtpPass" in input.credentials && input.credentials.smtpPass) {
            storageConfig.credentials.smtpPassEncrypted = encryptToBase64(
              input.credentials.smtpPass
            )
          }
        }
      }

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
