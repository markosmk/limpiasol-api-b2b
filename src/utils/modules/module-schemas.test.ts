/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { describe, expect, it, vi } from "vitest"
import { moduleDefinitions } from "./module-schemas"

// Mockeamos la encriptación para no depender de variables de entorno reales
vi.mock("@/utils/crypto", () => ({
  encryptToBase64: vi.fn((val) => `enc_${val}`)
}))

describe("Module Schemas & Hooks", () => {
  it("Email Module: onBeforeSave debe encriptar credenciales y borrar las originales", () => {
    // Tomamos la definición del módulo email
    const emailDef = moduleDefinitions.email

    // Ejecutamos el hook a mano con datos falsos
    const result = emailDef.onBeforeSave!({
      provider: "brevo",
      credentials: {
        apiKey: "secreto123",
        apiSecret: "supersecreto",
        fromEmail: "test@tesw.com",
        fromName: "Test"
      }
    })

    // Comprobamos que mutó correctamente el objeto
    expect((result.credentials as any).apiKey).toBeUndefined() // Se borró la original
    expect((result.credentials as any).apiSecret).toBeUndefined()

    expect(result.credentials.apiKeyEncrypted).toBe("enc_secreto123") // Se encriptó
    expect(result.credentials.apiSecretEncrypted).toBe("enc_supersecreto")
  })

  it("Shipping Module: No debe tener hook onBeforeSave", () => {
    // Módulos que no manejan secretos no deberían alterar la data
    const shippingDef = moduleDefinitions.shipping
    expect(shippingDef.onBeforeSave).toBeUndefined()
  })
})
