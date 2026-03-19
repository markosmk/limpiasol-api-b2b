/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import { BaseModule } from "../base.module"
import type { EmailModuleConfig } from "./email.module.types"

import { decryptFromBase64 } from "@/utils/crypto"
import { emailService } from "@/utils/email/email.service"

export class EmailModule extends BaseModule<EmailModuleConfig> {
  constructor() {
    super("email")
  }

  /**
   * Obtiene la API key desencriptada
   * Retorna null si no está configurada
   */
  private getApiKey(): string | null {
    if (!this.config?.credentials?.apiKeyEncrypted) {
      return null
    }

    try {
      return decryptFromBase64(this.config.credentials.apiKeyEncrypted)
    } catch (error) {
      console.error("[EmailModule] Failed to decrypt API key:", error)
      return null
    }
  }

  /**
   * Envía email usando tu EmailService, pero solo si el módulo está habilitado
   */
  async sendEmail(params: {
    to: string
    subject: string
    htmlContent: string
  }): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized()

    if (!this.enabled && process.env.NODE_ENV !== "development") {
      return { success: false, error: "Módulo de email no habilitado" }
    }

    const apiKey = this.getApiKey()
    if (!apiKey) {
      return { success: false, error: "API key not configured" }
    }

    // Usar apiKey para enviar email...
    if (this.config?.provider === "brevo") {
      // await brevoClient.send({ apiKey, ...params })
      // TODO: use apikey
      console.log("[Brevo] Sending email with key:", `${apiKey.slice(0, 8)}...`)
    }

    try {
      // Tu EmailService ya decide qué adapter usar (Brevo vs Console)
      await emailService.sendEmail(params)
      return { success: true }
    } catch (error) {
      console.error("[emailModule] Send failed:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido"
      }
    }
  }

  /**
   * Envío transaccional con templates predefinidos
   */
  async sendTransactionalEmail(params: {
    to: string
    templateKey: "order_created" | "order_paid" | "order_shipped" | "order_cancelled"
    templateParams: Record<string, any>
  }): Promise<{ success: boolean; error?: string }> {
    const templates: Record<string, (p: any) => string> = {
      order_created: (p) =>
        `<h2>¡Gracias por tu pedido! 🎉</h2><p>Pedido #${p.orderCode}</p><p>Total: $${p.total}</p>`,
      order_paid: (p) =>
        `<h2>¡Pago confirmado! ✅</h2><p>Pedido #${p.orderCode} en preparación</p>`,
      order_shipped: (p) =>
        `<h2>¡Tu pedido fue enviado! 📦</h2><p>Tracking: ${p.trackingNumber}</p>`,
      order_cancelled: (p) =>
        `<h2>Pedido cancelado</h2><p>Pedido #${p.orderCode}</p>${p.reason ? `<p>Motivo: ${p.reason}</p>` : ""}`
    }

    const htmlContent = templates[params.templateKey]?.(params.templateParams)
    if (!htmlContent) {
      return { success: false, error: `Template "${params.templateKey}" no encontrado` }
    }

    const subjects: Record<string, string> = {
      order_created: `Pedido #${params.templateParams.orderCode} recibido`,
      order_paid: `Pedido #${params.templateParams.orderCode} confirmado`,
      order_shipped: `Pedido #${params.templateParams.orderCode} enviado`,
      order_cancelled: `Pedido #${params.templateParams.orderCode} cancelado`
    }

    return this.sendEmail({
      to: params.to,
      subject: subjects[params.templateKey] ?? "Actualización de tu pedido",
      htmlContent
    })
  }
}

export const emailModule = new EmailModule()
