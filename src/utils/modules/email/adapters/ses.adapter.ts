import type { EmailProvider, SendEmailOptions } from "../email.module.types"

// import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"

export class SesEmailAdapter implements EmailProvider {
  // private client: SESClient
  async sendEmail(options: SendEmailOptions): Promise<void> {
    // const region = options.awsRegion || process.env.AWS_REGION || "us-east-1"
    // const accessKeyId = options.apiKey || process.env.AWS_ACCESS_KEY_ID
    // const secretAccessKey = options.apiSecret || process.env.AWS_SECRET_ACCESS_KEY

    console.log("--- EMAIL READY TO SEND (SES) ---")
    console.log(`To: ${options.to}`)
    console.log(`Subject: ${options.subject}`)
    console.log("---------------------------------")

    /*
    const client = new SESClient({
      region,
      credentials: (accessKeyId && secretAccessKey) ? {
        accessKeyId,
        secretAccessKey
      } : undefined
    })

    const toAddresses = Array.isArray(options.to) ? options.to : [options.to]
    
    const command = new SendEmailCommand({
      Source: options.sender?.email || process.env.AWS_SES_FROM_EMAIL,
      Destination: {
        ToAddresses: toAddresses
      },
      Message: {
        Subject: {
          Data: options.subject || "Sin asunto"
        },
        Body: {
          Html: {
            Data: options.htmlContent || ""
          }
        }
      }
    })

    await client.send(command)
    */
  }
}
