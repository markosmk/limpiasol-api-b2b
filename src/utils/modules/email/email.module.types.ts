/**
 * Módulo de Email (Email)
 * Configura proveedores de email, plantillas, etc.
 */
export type EmailModuleConfig = {
  /**
   * Proveedor de email
   */
  provider: "brevo" | "resend" | "smtp" | null
  /**
   * Credenciales de email
   */
  credentials: {
    /**
     * API Key encriptada
     */
    apiKeyEncrypted?: string
    /**
     * API Secret encriptada
     */
    apiSecretEncrypted?: string
    /**
     * Nombre del remitente
     */
    fromName: string
    /**
     * Email del remitente
     */
    fromEmail: string
  }
  /**
   * Plantillas de email
   */
  templates?: {
    orderCreated?: string
    orderPaid?: string
    orderShipped?: string
  }
}
