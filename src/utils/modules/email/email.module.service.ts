import { BrevoEmailAdapter } from "./adapters/brevo.adapter"
import { ConsoleEmailAdapter } from "./adapters/console.adapter"
import type { SendEmailOptions } from "./email.module.types"

export class EmailService {
  private brevoAdapter = new BrevoEmailAdapter()
  private consoleAdapter = new ConsoleEmailAdapter()

  async sendEmail(params: SendEmailOptions & { providerType?: string }) {
    // BREVO_API_KEY if force in .env
    const useBrevo = params.providerType === "brevo" || !!process.env.BREVO_API_KEY

    if (useBrevo) {
      await this.brevoAdapter.sendEmail(params)
    } else {
      await this.consoleAdapter.sendEmail(params)
    }
  }
}

export const emailService = new EmailService()
