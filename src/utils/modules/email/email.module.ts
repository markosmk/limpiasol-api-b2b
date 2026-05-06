/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */

import { BaseModule } from "../base.module"
import { type EmailService, emailService } from "./email.module.service"
import type { EmailModuleConfig, TemplateKey } from "./email.module.types"

import { decryptFromBase64 } from "@/utils/crypto"

export class EmailModule extends BaseModule<EmailModuleConfig> {
  constructor(private readonly emailService: EmailService) {
    super("email")
  }
  /**
   * Obtiene las credenciales desencriptadas y listas para usar en los adaptadores
   */
  private getDecryptedCredentials() {
    if (!this.config?.credentials) return {}

    const creds = this.config.credentials
    const decrypted: {
      apiKey?: string
      apiSecret?: string
      awsRegion?: string
      smtpHost?: string
      smtpPort?: number
      smtpSecure?: boolean
      smtpUser?: string
      smtpPass?: string
    } = {
      awsRegion: creds.awsRegion,
      smtpHost: creds.smtpHost,
      smtpPort: creds.smtpPort,
      smtpSecure: creds.smtpSecure
    }

    try {
      if (creds.apiKeyEncrypted) decrypted.apiKey = decryptFromBase64(creds.apiKeyEncrypted)
      if (creds.apiSecretEncrypted)
        decrypted.apiSecret = decryptFromBase64(creds.apiSecretEncrypted)
      if (creds.smtpUserEncrypted) decrypted.smtpUser = decryptFromBase64(creds.smtpUserEncrypted)
      if (creds.smtpPassEncrypted) decrypted.smtpPass = decryptFromBase64(creds.smtpPassEncrypted)
    } catch (error) {
      console.error("[EmailModule] Failed to decrypt credentials:", error)
    }

    return decrypted
  }

  /**
   * Envía email usando tu EmailService, pero solo si el módulo está habilitado
   */
  async sendEmail(params: {
    to: string
    subject: string
    htmlContent: string
    apiKey?: string
    providerType?: string
  }): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized()

    if (!this.enabled && process.env.NODE_ENV !== "development") {
      return { success: false, error: "Módulo de email no habilitado" }
    }

    const decryptedCredentials = this.getDecryptedCredentials()
    const apiKey = params.apiKey ?? decryptedCredentials.apiKey
    const providerType = params.providerType ?? this.config?.provider ?? "console"
    const sender = this.config?.credentials
      ? {
          name: this.config.credentials.fromName,
          email: this.config.credentials.fromEmail
        }
      : undefined

    try {
      // Tu EmailService ya decide qué adapter usar (Brevo vs Console)
      await this.emailService.sendEmail({
        ...decryptedCredentials,
        ...params,
        apiKey,
        providerType,
        sender
      })
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
   * Compilador ultra rápido para plantillas HTML personalizadas de la BD
   * Reemplaza {{ variable }} por su valor en params
   */
  private compileHtml(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      return params[key] !== undefined ? String(params[key]) : ""
    })
  }

  /**
   * Envío transaccional con templates predefinidos
   */
  async sendTransactionalEmail(params: {
    to: string | string[]
    templateKey: TemplateKey
    templateParams: Record<string, any>
  }): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized()

    if (!this.enabled && process.env.NODE_ENV !== "development") {
      return { success: false, error: "Módulo desactivado" }
    }

    const { to, templateKey, templateParams } = params
    const decryptedCredentials = this.getDecryptedCredentials()
    const apiKey = decryptedCredentials.apiKey
    const provider = this.config?.provider || "console"

    // Obtenemos el remitente configurado en la BD
    const sender = this.config?.credentials
      ? {
          name: this.config.credentials.fromName,
          email: this.config.credentials.fromEmail
        }
      : undefined

    try {
      // NIVEL 1: ¿Existe un Template ID en Brevo?
      if (provider === "brevo" && this.config?.templateIds?.[templateKey]) {
        await this.emailService.sendEmail({
          ...decryptedCredentials,
          to,
          sender,
          templateId: this.config.templateIds[templateKey],
          params: templateParams, // Brevo inyectará estas variables en su plataforma
          apiKey
        })
        return { success: true }
      }

      const subjects: Record<TemplateKey, string> = {
        orderCreated: `Solicitud de Pedido #${params.templateParams.orderCode} recibida`,
        orderPendingPayment: `Pedido #${params.templateParams.orderCode} - Listo para pago`,
        orderPaid: `Pago Confirmado - Pedido #${params.templateParams.orderCode}`,
        orderDispatched: `Actualización de Pedido #${params.templateParams.orderCode}`,
        orderCancelled: `Pedido Cancelado - #${params.templateParams.orderCode}`,
        userRegistered: "¡Bienvenido!",
        passwordReset: "Restablecimiento de contraseña",
        welcome: "¡Bienvenido!"
      }
      let htmlContent = ""
      // NIVEL 2: ¿Existe un HTML Custom en la BD?
      if (this.config?.templates?.[templateKey]) {
        htmlContent = this.compileHtml(this.config.templates[templateKey], templateParams)
      }
      // NIVEL 3: Fallback (El HTML por defecto del sistema)
      else {
        htmlContent = this.getDefaultFallbackHtml(templateKey, templateParams)
      }

      // Enviar usando HTML (Niveles 2 y 3)
      await this.emailService.sendEmail({
        ...decryptedCredentials,
        to,
        sender,
        subject: subjects[templateKey],
        htmlContent,
        apiKey
      })
      return { success: true }
    } catch (error) {
      console.error(`[EmailModule] Error enviando email (${templateKey}):`, error)
      return { success: false, error: "Fallo interno al enviar correo" }
    }
  }

  /**
   * Fallback de plantillas (Código duro si el admin no configuró nada)
   */
  private getDefaultFallbackHtml(key: TemplateKey, p: Record<string, any>): string {
    const fallbacks: Record<TemplateKey, (p: any) => string> = {
      // 1. Creado (Intención de compra)
      orderCreated: (p) => `
        <h2>¡Recibimos tu solicitud de pedido!</h2>
        <p>Hola, hemos registrado tu pedido <strong>#${p.orderCode}</strong> por un total inicial de $${p.total}.</p>
        <p><em>Importante:</em> Un asesor revisará el stock y los costos de envío. Nos pondremos en contacto a la brevedad o te enviaremos la confirmación final para que puedas realizar el pago.</p>
        <hr>
        <p>Revisá el detalle de tu pedido en tu panel de cliente.</p>
      `,
      // 2. Esperando Pago (La cotización final)
      orderPendingPayment: (p) => `
        <h2>Tu pedido está listo para el pago</h2>
        <p>Tu pedido <strong>#${p.orderCode}</strong> ya fue revisado y el stock está separado.</p>
        <p>El total definitivo a abonar es: <strong>$${p.total}</strong>.</p>
        <br>
        <h3>Instrucciones de pago:</h3>
        <p>${p.paymentInstructions || "Por favor, realizá la transferencia al CBU acordado y envianos el comprobante."}</p>
        ${p.adminNote ? `<p><strong>Nota del vendedor:</strong> ${p.adminNote}</p>` : ""}
      `,
      // 3. Pago Confirmado
      orderPaid: (p) => `
        <h2>¡Pago confirmado!</h2>
        <p>Hemos recibido correctamente el pago de tu pedido <strong>#${p.orderCode}</strong>.</p>
        <p>Ya comenzamos a preparar la mercadería. Te avisaremos cuando esté lista para su entrega.</p>
      `,
      // 4. Despachado / Listo para retirar (Dinámico según deliveryType)
      orderDispatched: (p) => {
        if (p.deliveryType === "pickup") {
          return `
            <h2>¡Tu pedido está listo para retirar!</h2>
            <p>El pedido <strong>#${p.orderCode}</strong> ya te está esperando.</p>
            <p><strong>Sucursal:</strong> ${p.pickupLocationName}</p>
            <p><strong>Dirección:</strong> ${p.pickupAddress}</p>
          `
        }
        return `
          <h2>¡Tu pedido está en camino!</h2>
          <p>El pedido <strong>#${p.orderCode}</strong> ya fue despachado.</p>
          ${p.trackingNumber ? `<p><strong>Seguimiento:</strong> ${p.trackingNumber}</p>` : ""}
        `
      },

      // 5. Cancelado
      orderCancelled: (p) => `
        <h2>Pedido cancelado</h2>
        <p>Te informamos que el pedido <strong>#${p.orderCode}</strong> ha sido cancelado.</p>
        ${p.reason ? `<p><strong>Motivo:</strong> ${p.reason}</p>` : ""}
        <p>Si creés que esto es un error, por favor contactanos.</p>
      `,

      // Auth templates
      userRegistered: (p) => `
        <h2>¡Bienvenido!</h2>
        <p>Hola, hemos registrado tu cuenta.</p>
        <p>Por favor, verifica tu correo electrónico haciendo clic en el siguiente enlace:</p>
        <a href="${p.verificationUrl}">Verificar correo electrónico</a>
      `,
      passwordReset: (p) => `
        <h2>Restablecimiento de contraseña</h2>
        <p>Hola, hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
        <p>Por favor, haz clic en el siguiente enlace para restablecer tu contraseña:</p>
        <a href="${p.resetUrl}">Restablecer contraseña</a>
      `,
      welcome: (p) => `
        <h2>¡Bienvenido!</h2>
        <p>Hola ${p.name || ""},</p>
        <p>¡Bienvenido a Limpiasol! ya puedes iniciar sesión.</p>
        <a href="${p.siteUrl}">Ir a la plataforma</a>
      `
    }

    return fallbacks[key]?.(p) || "<p>Actualización de pedido.</p>"
  }
}

export const emailModule = new EmailModule(emailService)
