import { BrevoEmailAdapter } from "./adapters/brevo.adapter"
import { ConsoleEmailAdapter } from "./adapters/console.adapter"
import type { EmailProvider } from "./email-provider.interface"

export class EmailService {
  private provider: EmailProvider

  constructor() {
    if (process.env.BREVO_API_KEY) {
      this.provider = new BrevoEmailAdapter()
    } else {
      this.provider = new ConsoleEmailAdapter()
    }
  }

  async sendWelcomeEmail(to: string, name?: string) {
    await this.provider.sendEmail({
      to,
      subject: "Bienvenido a Limpiasol",
      htmlContent: `<p>Hola ${name || ""},</p><p>¡Bienvenido a la plataforma Limpiasol! ya puedes iniciar sesión.</p>`
    })
  }

  async sendVerificationEmail(to: string, token: string) {
    const baseUrl = process.env.APP_URL || "http://localhost:3000"
    const verificationLink = `${baseUrl}/verify-email?token=${token}`

    await this.provider.sendEmail({
      to,
      subject: "Verificar correo electrónico",
      htmlContent: `<p>Haz clic aquí para verificar tu correo electrónico:</p><a href="${verificationLink}">Verificar correo electrónico</a>`
    })
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const baseUrl = process.env.APP_URL || "http://localhost:3000"
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    await this.provider.sendEmail({
      to,
      subject: "Restablecer contraseña",
      htmlContent: `<p>Haz clic aquí para restablecer tu contraseña:</p><a href="${resetLink}">Restablecer contraseña</a>`
    })
  }
}

export const emailService = new EmailService()
