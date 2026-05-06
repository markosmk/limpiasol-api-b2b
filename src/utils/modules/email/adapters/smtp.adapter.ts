import type { EmailProvider, SendEmailOptions } from "../email.module.types"

import { appEvents, EventTypes } from "@/events/emitter"

// import nodemailer from "nodemailer"

export class SmtpEmailAdapter implements EmailProvider {
  // private transporter: nodemailer.Transporter | null = null

  constructor() {
    appEvents.on(EventTypes.MODULE_CONFIG_UPDATED, (moduleName) => {
      if (moduleName === "email") {
        console.log(
          "[SmtpEmailAdapter] Invalidando transporter SMTP por actualización de configuración"
        )
        // this.transporter = null
      }
    })
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const host = options.smtpHost || process.env.SMTP_HOST
    const port = options.smtpPort || Number(process.env.SMTP_PORT)
    // const secure = options.smtpSecure ?? process.env.SMTP_SECURE === "true"
    // const user = options.smtpUser || process.env.SMTP_USER
    // const pass = options.smtpPass || process.env.SMTP_PASS

    if (!host || !port) {
      console.warn("SMTP host or port not configured, email not sent.")
      return
    }

    /*
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined
      })
      console.log("[SmtpEmailAdapter] Nuevo transporter SMTP creado y cacheado")
    }
    */

    console.log("--- EMAIL READY TO SEND (SMTP) ---")
    console.log(`To: ${options.to}`)
    console.log(`Subject: ${options.subject}`)
    console.log("----------------------------------")

    /*
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to
    await this.transporter.sendMail({
      from: options.sender?.email || process.env.SMTP_FROM,
      to,
      subject: options.subject || "Sin asunto",
      html: options.htmlContent || "",
    })
    */
  }
}
