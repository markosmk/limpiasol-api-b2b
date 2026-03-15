import type { EmailProvider, SendEmailOptions } from "../email-provider.interface"

export class BrevoEmailAdapter implements EmailProvider {
  private apiKey: string
  private endpoint = "https://api.brevo.com/v3/smtp/email"

  constructor() {
    const key = process.env.BREVO_API_KEY
    if (!key) {
      console.warn("BREVO_API_KEY is not defined.")
    }
    this.apiKey = key || ""
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.apiKey) {
      console.error("No Brevo API key available, email not sent.")
      return
    }

    const payload = {
      sender: { email: process.env.EMAIL_FROM || "noreply@limpiasol.com", name: "Limpiasol" },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.htmlContent
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": this.apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Brevo API error:", errorText)
      throw new Error(`Failed to send email via Brevo: ${response.statusText}`)
    }
  }
}
