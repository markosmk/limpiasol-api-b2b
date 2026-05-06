import { BrevoEmailAdapter } from "./adapters/brevo.adapter"
import { ConsoleEmailAdapter } from "./adapters/console.adapter"
import { ResendEmailAdapter } from "./adapters/resend.adapter"
import { SesEmailAdapter } from "./adapters/ses.adapter"
import { SmtpEmailAdapter } from "./adapters/smtp.adapter"
import type { SendEmailOptions } from "./email.module.types"

export class EmailService {
  private brevoAdapter = new BrevoEmailAdapter()
  private consoleAdapter = new ConsoleEmailAdapter()
  private resendAdapter = new ResendEmailAdapter()
  private smtpAdapter = new SmtpEmailAdapter()
  private sesAdapter = new SesEmailAdapter()

  async sendEmail(params: SendEmailOptions & { providerType?: string }) {
    let provider = params.providerType

    if (!provider) {
      if (process.env.BREVO_API_KEY) {
        provider = "brevo"
      } else {
        provider = "console"
      }
    }

    switch (provider) {
      case "brevo":
        await this.brevoAdapter.sendEmail(params)
        break
      case "resend":
        await this.resendAdapter.sendEmail(params)
        break
      case "smtp":
        await this.smtpAdapter.sendEmail(params)
        break
      case "ses":
        await this.sesAdapter.sendEmail(params)
        break
      case "console":
        await this.consoleAdapter.sendEmail(params)
        break
      default:
        await this.consoleAdapter.sendEmail(params)
        break
    }
  }
}

export const emailService = new EmailService()
