import crypto from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32 // 256 bits

/**
 * Obtiene la clave de encriptación desde ENV
 * Debe ser una string de 32 caracteres (256 bits)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY no está definida en .env\n" +
        "Generar con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    )
  }

  if (key.length !== KEY_LENGTH * 2) {
    throw new Error(
      `ENCRYPTION_KEY debe tener ${KEY_LENGTH * 2} caracteres hexadecimales (${KEY_LENGTH} bytes)`
    )
  }

  return Buffer.from(key, "hex")
}

/**
 * Encripta un valor sensible (API key, password, etc.)
 * Retorna: { encrypted, iv, authTag }
 *
 * @example
 * const { encrypted, iv, authTag } = encrypt("sk_live_abc123")
 * // Guardar los 3 valores en DB
 */
export function encrypt(value: string): {
  encrypted: string
  iv: string
  authTag: string
} {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  })

  let encrypted = cipher.update(value, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag().toString("hex")

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag
  }
}

/**
 * Desencripta un valor previamente encriptado
 *
 * @example
 * const decrypted = decrypt({
 *   encrypted: "...",
 *   iv: "...",
 *   authTag: "..."
 * })
 */
export function decrypt(params: { encrypted: string; iv: string; authTag: string }): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(params.iv, "hex")
  const authTag = Buffer.from(params.authTag, "hex")

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  })

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(params.encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Encripta y retorna un string base64 con todo incluido
 * Formato: iv:encrypted:authTag (todo en base64/hex)
 * Útil para guardar en un solo campo de DB
 */
export function encryptToBase64(value: string): string {
  const { encrypted, iv, authTag } = encrypt(value)
  return `${iv}:${encrypted}:${authTag}`
}

/**
 * Desencripta desde un string base64
 */
export function decryptFromBase64(encryptedData: string): string {
  const [iv, encrypted, authTag] = encryptedData.split(":")

  if (!iv || !encrypted || !authTag) {
    throw new Error("Formato de encriptación inválido")
  }

  return decrypt({ encrypted, iv, authTag })
}

/**
 * Para hashes unidireccionales (como session IDs)
 * No se puede recuperar el original
 */
export function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function verifyHash(value: string, hashedValue: string): boolean {
  return hash(value) === hashedValue
}
