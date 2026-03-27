import * as v from "valibot"

export const updateMeSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.minLength(2))),
  phone: v.optional(v.string()),
  ivaCategory: v.optional(v.string()),
  profileInfo: v.optional(
    v.object({
      companyName: v.optional(v.string()),
      tradeName: v.optional(v.string()),
      notes: v.optional(v.string())
    })
  )
})

export const changePasswordSchema = v.object({
  oldPassword: v.pipe(v.string(), v.minLength(1)),
  newPassword: v.pipe(v.string(), v.minLength(6))
})

export type UpdateMeInput = v.InferInput<typeof updateMeSchema>
export type ChangePasswordInput = v.InferInput<typeof changePasswordSchema>
