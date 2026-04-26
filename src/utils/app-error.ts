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
  NOT_FOUND: { status: 404, message: "Recurso no encontrado." },
  VALIDATION_RULES: { status: 400, message: "Validación de reglas de compra fallida." },
  price_not_found: { status: 404, message: "Precio no disponible." },
  custom: { status: 400, message: "Error inesperado." },
  // ERRORs for ORDERS
  // act: validar front antes de enviar
  ORDER_EMPTY: { status: 400, message: "El pedido debe tener al menos un item." },
  ORDER_CANNOT_BE_EMPTY: {
    status: 400,
    message: "No puedes eliminar el único producto. Cancela la orden en su lugar."
  },
  ORDER_NOT_CANCELLABLE: {
    status: 400,
    message:
      "No puedes cancelar un pedido que ya está en preparación o enviado. Contacta a soporte."
  },
  // act: mostrar purchaseRules al usuario
  ORDER_INVALID_QUANTITY: { status: 400, message: "Cantidad no respeta reglas del producto." },
  // act: validar que sea futura y en horario hábil
  ORDER_INVALID_SCHEDULE: { status: 400, message: "Fecha/hora de retiro inválida." },
  // act: redirigir a lista de pedidos
  ORDER_NOT_FOUND: { status: 404, message: "Pedido no existe o no pertenece al usuario." },
  // act: no exponer este error al usuario final
  ORDER_FORBIDDEN: { status: 403, message: "No tienes permiso para ver esta orden." },
  // act: mostrar mensaje: "No se puede cambiar a X desde Y"
  ORDER_INVALID_TRANSITION: { status: 400, message: "Cambio de estado no permitido." },
  // act: informar: "Contactar a soporte para modificaciones"
  ORDER_NOT_EDITABLE: { status: 400, message: "Intento de ajustar pedido ya pagado/enviado." },
  // act: informar: "Contactar a soporte para modificaciones"
  ORDER_CREATE_FAILED: { status: 500, message: "Error al crear la orden." },
  ORDER_CODE_COLLISION: {
    status: 409,
    message: "El código de la orden ya existe o no se pudo generar un código único."
  },
  ORDER_MISSING_PICKUP: { status: 400, message: "Debe especificar sucursal y horario para retiro" },
  ORDER_MISSING_REASON: { status: 400, message: "Debe especificar un motivo para cancelar" },
  ITEM_NOT_FOUND: { status: 404, message: "El item no existe en la orden." },
  // prodps
  PRODUCT_NOT_FOUND: { status: 404, message: "Producto no encontrado" },
  VALIDATION_ERROR: { status: 400, message: "Validación fallida" }
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
