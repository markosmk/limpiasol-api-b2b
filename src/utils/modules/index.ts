// Modules (singleton instances)
export { analyticsModule } from "./analytics/analytics.module"
export { discountsModule } from "./discounts/discounts.module"
export { emailModule } from "./email/email.module"
// ModuleManager (helper genérico)
export { moduleManager } from "./module-manager"
export { shippingModule } from "./shipping/shipping.module"
export { taxesModule } from "./taxes/taxes.module"
// Types
export type { AnalyticsModuleConfig } from "./analytics/analytics.module.types"
export type { DiscountsModuleConfig } from "./discounts/discounts.module.types"
export type { EmailModuleConfig } from "./email/email.module.types"
export type { ModuleConfig } from "./module.types"
export type { ShippingModuleConfig } from "./shipping/shipping.module.types"
export type { TaxesModuleConfig } from "./taxes/taxes.module.types"
