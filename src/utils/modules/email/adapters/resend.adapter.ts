import type { EmailProvider, SendEmailOptions } from "../email.module.types"

// import { Resend } from "resend"

export class ResendEmailAdapter implements EmailProvider {
  // private resend: Resend

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const apiKey = options.apiKey || process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn("No Resend API key available, email not sent.")
      return
    }

    console.log("--- EMAIL READY TO SEND (RESEND) ---")
    console.log(`To: ${options.to}`)
    console.log(`Subject: ${options.subject}`)
    console.log("------------------------------------")

    /*
    const resend = new Resend(apiKey)
    const to = Array.isArray(options.to) ? options.to : [options.to]
    await resend.emails.send({
      from: options.sender?.email || "onboarding@resend.dev",
      to,
      subject: options.subject || "Sin asunto",
      html: options.htmlContent || "",
    })
    */
  }
}
