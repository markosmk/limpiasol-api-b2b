import * as v from "valibot"

export const loginSchema = v.object({
  email: v.pipe(v.string(), v.email("El email es inválido")),
  password: v.pipe(v.string(), v.minLength(6, "La contraseña debe tener al menos 6 caracteres"))
})

export const registerSchema = v.object({
  email: v.pipe(v.string(), v.email("El email es inválido")),
  password: v.pipe(v.string(), v.minLength(6, "La contraseña debe tener al menos 6 caracteres"))
})

export const forgotPasswordSchema = v.object({
  email: v.pipe(v.string(), v.email("El email es inválido"))
})

export const resetPasswordSchema = v.object({
  token: v.pipe(v.string(), v.minLength(1, "El token es requerido")),
  password: v.pipe(v.string(), v.minLength(6, "La contraseña debe tener al menos 6 caracteres"))
})

export type LoginInput = v.InferInput<typeof loginSchema>
export type RegisterInput = v.InferInput<typeof registerSchema>
export type ForgotPasswordInput = v.InferInput<typeof forgotPasswordSchema>
export type ResetPasswordInput = v.InferInput<typeof resetPasswordSchema>
