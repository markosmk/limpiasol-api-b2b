/**
 * Módulo de Email (Email)
 * Configura proveedores de email, plantillas, etc.
 */
export type EmailModuleConfig = {
  /**
   * Proveedor de email
   */
  provider: "brevo" | "resend" | "smtp" | "console" | "ses" | null
  credentials: {
    /**
     * API Key encriptada
     */
    apiKeyEncrypted?: string
    /**
     * API Secret encriptada
     */
    apiSecretEncrypted?: string
    fromName: string
    fromEmail: string

    // AWS SES
    awsRegion?: string

    // SMTP
    smtpHost?: string
    smtpPort?: number
    smtpSecure?: boolean
    smtpUserEncrypted?: string
    smtpPassEncrypted?: string
  }
  /**
   * Plantillas de email
   */
  templates?: Record<string, string>
  /**
   * IDs de plantillas de Brevo (usualmente son números)
   */
  templateIds?: Record<string, string>
}

export type TemplateKey =
  // Orders
  | "orderCreated"
  | "orderPendingPayment"
  | "orderPaid"
  | "orderDispatched"
  | "orderCancelled"
  // Auth
  | "userRegistered"
  | "passwordReset"
  | "welcome"

export interface SendEmailOptions {
  to: string | string[]
  // Sender
  sender?: { name: string; email: string }
  // Option: HTML
  subject?: string
  htmlContent?: string
  // Option: Provider Template (Brevo, number)
  templateId?: string
  params?: Record<string, unknown>
  // aditional
  apiKey?: string
  apiSecret?: string
  awsRegion?: string
  smtpHost?: string
  smtpPort?: number
  smtpSecure?: boolean
  smtpUser?: string
  smtpPass?: string
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<void>
}
