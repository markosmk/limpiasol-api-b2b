/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { moduleManager } from "../module-manager"
import { EmailModule } from "./email.module"

vi.mock("@/utils/crypto", () => ({
  decryptFromBase64: vi.fn((val) => {
    if (val === "enc_api_key") return "decrypted_api_key"
    if (val === "enc_api_secret") return "decrypted_api_secret"
    if (val === "enc_smtp_user") return "decrypted_smtp_user"
    if (val === "enc_smtp_pass") return "decrypted_smtp_pass"
    return "fake_api_key_decrypted"
  })
}))

vi.mock("../module-manager", () => ({
  moduleManager: {
    getConfig: vi.fn()
  }
}))

describe("EmailModule - Templating Cascade", () => {
  let module: EmailModule
  const mockEmailService = {
    sendEmail: vi.fn().mockResolvedValue(undefined)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    module = new EmailModule(mockEmailService as any)

    // mock config valid
    vi.mocked(moduleManager.getConfig).mockResolvedValue({
      enabled: true,
      config: {
        provider: "brevo",
        credentials: {
          apiKeyEncrypted: "iv:encrypted:authTag", // base64 encrypted
          fromName: "Limpiasol Test",
          fromEmail: "test@limpiasol.com"
        }
      }
    })
  })

  it("NIVEL 1: Debe usar Template ID si el proveedor es Brevo y el ID existe", async () => {
    // overwrite mock config to add templateIds
    vi.mocked(moduleManager.getConfig).mockResolvedValue({
      enabled: true,
      config: {
        provider: "brevo",
        credentials: { fromName: "T", fromEmail: "t@t.com", apiKeyEncrypted: "fake" },
        templateIds: { orderCreated: "42" } // simulated template id
      }
    })

    await module.sendTransactionalEmail({
      to: "cliente@test.com",
      templateKey: "orderCreated",
      templateParams: { orderCode: "A1B2", total: "1500" }
    })

    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1)
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "cliente@test.com",
        templateId: "42", // used template id
        params: { orderCode: "A1B2", total: "1500" },
        apiKey: "fake_api_key_decrypted" // used crypto mock
      })
    )

    const callArgs = vi.mocked(mockEmailService.sendEmail).mock.calls[0][0]
    expect(callArgs.htmlContent).toBeUndefined()
  })

  it("NIVEL 2: Debe compilar HTML Custom si no hay Template ID", async () => {
    vi.mocked(moduleManager.getConfig).mockResolvedValue({
      enabled: true,
      config: {
        provider: "smtp",
        credentials: { fromName: "T", fromEmail: "t@t.com", apiKeyEncrypted: "fake" },
        templates: {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: <explanation >
          orderCreated: "<h1>Hola, tu pedido {{ orderCode }} vale ${{ total }}</h1>"
        }
      }
    })

    await module.sendTransactionalEmail({
      to: "cliente@test.com",
      templateKey: "orderCreated",
      templateParams: { orderCode: "Z9Y8", total: "3000" }
    })

    const callArgs = vi.mocked(mockEmailService.sendEmail).mock.calls[0][0]
    expect(callArgs.templateId).toBeUndefined()
    expect(callArgs.htmlContent).toBe("<h1>Hola, tu pedido Z9Y8 vale $3000</h1>")
  })

  it("NIVEL 3: Debe usar el Fallback si la BD no tiene plantillas configuradas", async () => {
    await module.sendTransactionalEmail({
      to: "cliente@test.com",
      templateKey: "orderCreated",
      templateParams: { orderCode: "FALL-1", total: "999" }
    })

    const callArgs = vi.mocked(mockEmailService.sendEmail).mock.calls[0][0]

    expect(callArgs.htmlContent).toContain("FALL-1")
    expect(callArgs.htmlContent).toContain("999")
    expect(callArgs.htmlContent).toContain("Recibimos tu solicitud de pedido")
  })

  it("Debe fallar silenciosamente si el módulo está deshabilitado en Producción", async () => {
    // disable the module
    vi.mocked(moduleManager.getConfig).mockResolvedValue({
      enabled: false,
      config: null
    })

    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = "production"

    const result = await module.sendTransactionalEmail({
      to: "cliente@test.com",
      templateKey: "orderCreated",
      templateParams: { orderCode: "123", total: "1" }
    })

    expect(result.success).toBe(false)
    expect(mockEmailService.sendEmail).not.toHaveBeenCalled()

    process.env.NODE_ENV = originalEnv
  })

  it("Debe desencriptar y pasar todas las credenciales correctas al adaptador (SES/SMTP)", async () => {
    vi.mocked(moduleManager.getConfig).mockResolvedValue({
      enabled: true,
      config: {
        provider: "smtp",
        credentials: {
          fromName: "T",
          fromEmail: "t@t.com",
          apiKeyEncrypted: "enc_api_key",
          apiSecretEncrypted: "enc_api_secret",
          smtpUserEncrypted: "enc_smtp_user",
          smtpPassEncrypted: "enc_smtp_pass",
          smtpHost: "smtp.test.com",
          smtpPort: 587
        }
      }
    })

    await module.sendTransactionalEmail({
      to: "cliente@test.com",
      templateKey: "orderCreated",
      templateParams: { orderCode: "TEST", total: "100" }
    })

    expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1)
    
    const callArgs = vi.mocked(mockEmailService.sendEmail).mock.calls[0][0]
    expect(callArgs.apiKey).toBe("decrypted_api_key")
    expect(callArgs.apiSecret).toBe("decrypted_api_secret")
    expect(callArgs.smtpUser).toBe("decrypted_smtp_user")
    expect(callArgs.smtpPass).toBe("decrypted_smtp_pass")
    expect(callArgs.smtpHost).toBe("smtp.test.com")
    expect(callArgs.smtpPort).toBe(587)
  })
})
