import * as v from "valibot"

const AddressSchema = v.object({
  fullName: v.pipe(v.string(), v.minLength(2, "Nombre muy corto")),
  addressLine1: v.string("Calle requerida"),
  addressLine2: v.optional(v.string()),
  city: v.string("Ciudad requerida"),
  province: v.string("Provincia requerida"),
  postalCode: v.pipe(v.string(), v.regex(/^\d{4}$/, "Código postal inválido")),
  phone: v.pipe(v.string(), v.regex(/^\+?\d{10,15}$/, "Teléfono inválido")),
  notes: v.optional(v.string())
})

const CreateOrderSchema = v.object({
  deliveryType: v.union([v.literal("shipping"), v.literal("pickup")]),
  shippingData: v.optional(AddressSchema),
  billingData: v.optional(AddressSchema),
  pickupLocationData: v.optional(
    v.object({
      locationId: v.string(),
      locationName: v.string(),
      address: v.string(),
      scheduledDate: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD")),
      scheduledTime: v.pipe(
        v.string(),
        v.regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM")
      ),
      notes: v.optional(v.string())
    })
  ),
  observations: v.optional(v.string())
  // cartId: v.string()
})

const CancelOrderSchema = v.object({
  reason: v.pipe(v.string(), v.minLength(10, "Motivo muy corto"))
})

const OrderStatusSchema = v.union([
  v.literal("pending"),
  v.literal("adjusting"),
  v.literal("pending_payment"),
  v.literal("paid"),
  v.literal("shipped"),
  v.literal("ready_pickup"),
  v.literal("delivered"),
  v.literal("cancelled")
])

const UpdateStatusSchema = v.object({
  status: OrderStatusSchema,
  reason: v.optional(v.string())
})

const GetOrdersQuerySchema = v.object({
  page: v.optional(v.pipe(v.string(), v.transform(Number))),
  limit: v.optional(v.pipe(v.string(), v.transform(Number))),
  status: v.optional(v.union([OrderStatusSchema, v.array(OrderStatusSchema)])),
  deliveryType: v.optional(v.union([v.literal("shipping"), v.literal("pickup")])),
  startDate: v.optional(v.string()), // ISO date
  endDate: v.optional(v.string()),
  search: v.optional(v.string()), // orderCode o orderNumber
  userId: v.optional(v.string()),
  orderBy: v.optional(v.union([v.literal("createdAt"), v.literal("total"), v.literal("status")])),
  orderDir: v.optional(v.union([v.literal("asc"), v.literal("desc")]))
  // paymentStatus: v.optional(v.string()),
  // orderCode: v.optional(v.string()),
})

const GlobalErrorSchema = v.object({
  statusCode: v.number(),
  code: v.string(),
  message: v.string(),
  issues: v.optional(v.any())
})

export {
  CancelOrderSchema,
  CreateOrderSchema,
  GetOrdersQuerySchema,
  GlobalErrorSchema,
  UpdateStatusSchema
}
