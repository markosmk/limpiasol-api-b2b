const ERROR_DICTIONARY = {
  invalid_credentials: { status: 401, message: "Credenciales inválidas, intenta nuevamente." },
  account_inactive: { status: 403, message: "Tu cuenta aún no ha sido aprobada o no está activa." },
  user_already_exists: { status: 409, message: "El usuario ya existe." },
  user_not_found: { status: 404, message: "El usuario no existe." },
  token_expired: { status: 401, message: "El token de seguridad ha expirado." },
  too_many_requests: {
    status: 429,
    message: "Demasiadas solicitudes, espera 60 segundos para solicitar nuevamente."
  },
  invalid_or_expired_token: { status: 401, message: "Token inválido o expirado." },
  unauthorized: { status: 401, message: "No autorizado." },
  not_found: { status: 404, message: "Recurso no encontrado." },
  custom: { status: 400, message: "Error inesperado." }
} as const

export type ErrorCode = keyof typeof ERROR_DICTIONARY // | (string & {})

interface AppErrorParams {
  code: ErrorCode
  message?: string
  statusCode?: number
}

export class AppError extends Error {
  statusCode: number
  code: string

  constructor({ code, message, statusCode }: AppErrorParams) {
    const defaultError = ERROR_DICTIONARY[code as keyof typeof ERROR_DICTIONARY]
    super(message || defaultError?.message || "Error inesperado")
    this.code = code
    this.statusCode = statusCode || defaultError?.status || 400
    this.name = "AppError"

    Error.captureStackTrace(this, this.constructor)
  }
}
