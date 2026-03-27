import * as v from "valibot"

import { moduleNames } from "@/utils/modules/module-schemas"

export const updateSettingsSchema = v.object({
  key: v.pipe(v.string(), v.nonEmpty()),
  value: v.unknown(),
  category: v.optional(v.string())
})

export type UpdateSettingsInput = v.InferOutput<typeof updateSettingsSchema>

export const moduleParamsSchema = v.object({
  name: v.picklist(moduleNames, "Módulo no encontrado")
})

export const baseUpdateModuleSchema = v.object({
  enabled: v.boolean(),
  config: v.optional(v.record(v.string(), v.unknown()))
})

// each section of settings
export const notificationsSettingsSchema = v.object({
  notificationsRecipients: v.array(v.string()),
  notifications: v.object({
    notifyOnNewOrder: v.boolean(),
    notifyOnNewRegistration: v.boolean(),
    notifyOnNewMessage: v.boolean()
  })
})

export type NotificationsSettingsInput = v.InferOutput<typeof notificationsSettingsSchema>

export const storeSettingsSchema = v.object({
  storeName: v.string(),
  storeEmail: v.string(),
  storePhone: v.string(),
  storeAddress: v.string(),
  storeLogo: v.string(),
  storeFavicon: v.string(),
  storeSocialLinks: v.array(v.string()),
  storePaymentMethods: v.array(v.string()),
  storeShippingMethods: v.array(v.string()),
  storeReturnPolicy: v.string(),
  storePrivacyPolicy: v.string(),
  storeTermsAndConditions: v.string(),
  storeCurrency: v.string(),
  storeLanguage: v.string(),
  storeTimezone: v.string(),
  paymentInstructions: v.string()
})

export type StoreSettingsInput = v.InferOutput<typeof storeSettingsSchema>
