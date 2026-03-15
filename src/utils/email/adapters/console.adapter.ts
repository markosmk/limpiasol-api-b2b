import type { EmailProvider, SendEmailOptions } from "../email-provider.interface"

export class ConsoleEmailAdapter implements EmailProvider {
  async sendEmail(options: SendEmailOptions): Promise<void> {
    console.log("--- EMAIL SENT (CONSOLE) ---")
    console.log(`To: ${options.to}`)
    console.log(`Subject: ${options.subject}`)
    console.log("Content:")
    console.log(options.htmlContent)
    console.log("----------------------------")
  }
}
