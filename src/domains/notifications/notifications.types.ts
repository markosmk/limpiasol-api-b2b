import type { DeliveryType } from "@/db/pg/orders.types"

export type OrderNotification = {
  orderCode: string
  total?: string
  deliveryType?: DeliveryType
  pickupLocationData?: {
    locationName: string
    address: string
  } | null
}
