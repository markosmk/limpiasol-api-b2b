import type { EmailProvider, SendEmailOptions } from "../email.module.types"

export class BrevoEmailAdapter implements EmailProvider {
  private endpoint = "https://api.brevo.com/v3/smtp/email"

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const apiKey = options.apiKey || process.env.BREVO_API_KEY
    if (!apiKey) {
      console.warn("No Brevo API key available, email not sent.")
      return
    }

    const toList = Array.isArray(options.to)
      ? options.to.map((email) => ({ email }))
      : [{ email: options.to }]

    // biome-ignore lint/suspicious/noExplicitAny: <explanation >
    const payload: any = {
      to: toList,
      sender: options.sender
    }

    if (options.templateId) {
      payload.templateId = Number(options.templateId)
      if (options.params) payload.params = options.params
    } else {
      payload.subject = options.subject
      payload.htmlContent = options.htmlContent
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json"
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
