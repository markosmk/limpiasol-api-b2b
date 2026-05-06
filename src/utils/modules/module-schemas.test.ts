/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { describe, expect, it, vi } from "vitest"
import { moduleDefinitions } from "./module-schemas"

// Mockeamos la encriptación para no depender de variables de entorno reales
vi.mock("@/utils/crypto", () => ({
  encryptToBase64: vi.fn((val) => `enc_${val}`)
}))

describe("Module Schemas & Hooks", () => {
  const emailDef = moduleDefinitions.email

  describe("Email Module: onBeforeSave", () => {
    it("Debe encriptar apiKey y descartar la original (Brevo/Resend)", () => {
      const result = emailDef.onBeforeSave!({
        provider: "brevo",
        credentials: {
          apiKey: "secreto123",
          fromEmail: "test@tesw.com",
          fromName: "Test"
        }
      })

      // Se debe haber conservado fromName y fromEmail
      expect(result.credentials.fromName).toBe("Test")
      expect(result.credentials.fromEmail).toBe("test@tesw.com")

      // Se borró la original
      expect((result.credentials as any).apiKey).toBeUndefined()
      
      // Se encriptó
      expect(result.credentials.apiKeyEncrypted).toBe("enc_secreto123")
      expect(result.credentials.apiSecretEncrypted).toBeUndefined()
    })

    it("Debe encriptar apiKey y apiSecret para AWS SES", () => {
      const result = emailDef.onBeforeSave!({
        provider: "ses",
        credentials: {
          awsRegion: "us-east-1",
          apiKey: "aws_key_123",
          apiSecret: "aws_secret_456",
          fromEmail: "ses@test.com",
          fromName: "SES Test"
        }
      })

      expect((result.credentials as any).apiKey).toBeUndefined()
      expect((result.credentials as any).apiSecret).toBeUndefined()

      expect(result.credentials.awsRegion).toBe("us-east-1")
      expect(result.credentials.apiKeyEncrypted).toBe("enc_aws_key_123")
      expect(result.credentials.apiSecretEncrypted).toBe("enc_aws_secret_456")
    })

    it("Debe encriptar smtpUser y smtpPass para SMTP", () => {
      const result = emailDef.onBeforeSave!({
        provider: "smtp",
        credentials: {
          smtpHost: "smtp.mail.com",
          smtpPort: 587,
          smtpSecure: true,
          smtpUser: "usuario_smtp",
          smtpPass: "pass_smtp",
          fromEmail: "smtp@test.com",
          fromName: "SMTP Test"
        }
      })

      expect((result.credentials as any).smtpUser).toBeUndefined()
      expect((result.credentials as any).smtpPass).toBeUndefined()

      expect(result.credentials.smtpHost).toBe("smtp.mail.com")
      expect(result.credentials.smtpPort).toBe(587)
      expect(result.credentials.smtpSecure).toBe(true)

      expect(result.credentials.smtpUserEncrypted).toBe("enc_usuario_smtp")
      expect(result.credentials.smtpPassEncrypted).toBe("enc_pass_smtp")
    })
  })

  it("Shipping Module: No debe tener hook onBeforeSave", () => {
    // Módulos que no manejan secretos no deberían alterar la data
    const shippingDef = moduleDefinitions.shipping
    expect(shippingDef.onBeforeSave).toBeUndefined()
  })
})
