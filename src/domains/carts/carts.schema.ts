import * as v from "valibot"

// --- Entidades Base ---
export const CartSchema = v.object({
  id: v.pipe(v.string(), v.cuid2()),
  userId: v.pipe(v.string(), v.cuid2()),
  status: v.picklist(["active", "abandoned", "converted"]),
  createdAt: v.date(),
  updatedAt: v.date()
})

export const CartItemSchema = v.object({
  id: v.pipe(v.string(), v.cuid2()),
  cartId: v.pipe(v.string(), v.cuid2()),
  productId: v.pipe(v.string(), v.cuid2()),
  variantId: v.optional(v.pipe(v.string(), v.cuid2())),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
  createdAt: v.date(),
  updatedAt: v.date()
})

// --- DTOs de Entrada (Para Rutas/Controladores) ---
export const AddToCartDto = v.object({
  productId: v.pipe(v.string(), v.cuid2()),
  variantId: v.optional(v.pipe(v.string(), v.cuid2())),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(1, "La cantidad mínima es 1"))
})

export const UpdateCartItemDto = v.object({
  variantId: v.optional(v.pipe(v.string(), v.cuid2())),
  quantity: v.pipe(v.number(), v.integer(), v.minValue(0, "Usa 0 para eliminar el ítem"))
})

// Tipos inferidos para inyectar en Servicios y Repositorios
export type Cart = v.InferOutput<typeof CartSchema>
export type CartItem = v.InferOutput<typeof CartItemSchema>
export type AddToCartInput = v.InferOutput<typeof AddToCartDto>
