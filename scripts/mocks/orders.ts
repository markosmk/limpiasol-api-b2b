import type { OrderInsert, OrderItemInsert } from "@/db/pg/orders"

export const mockOrders: OrderInsert[] = [
  {
    id: "ord_1",
    userId: "usr_reseller",
    orderCode: "RES-88A9",
    status: "pending_payment",
    subtotal: "42000.00",
    total: "42000.00",
    deliveryType: "pickup",
    pickupLocationData: {
      locationId: "loc_central",
      locationName: "Depósito Central",
      address: "Av. Industrial 123",
      scheduledDate: "2026-11-15",
      scheduledTime: "10:00"
    }
  },
  {
    id: "ord_2",
    userId: "usr_retail",
    orderCode: "RET-99B1",
    status: "paid",
    subtotal: "4900.00", // 1200 + 3700 (2500 det + 1200 envio?)
    total: "4900.00",
    deliveryType: "shipping",
    shippingData: {
      fullName: "Juan Perez",
      addressLine1: "Calle Falsa 123",
      addressLine2: "Casa 1",
      city: "Buenos Aires",
      province: "CABA",
      postalCode: "1000",
      phone: "1123456789"
    }
  }
]

export const mockOrderItems: OrderItemInsert[] = [
  // Items para ord_1 (Reseller)
  {
    orderId: "ord_1",
    productId: "prod_lavandina",
    variantId: "var_lav_5L",
    productName: "Lavandina Concentrada Limpiasol",
    variantName: "Bidón 5 Litros",
    quantity: 10,
    unitPrice: "3500.00",
    lineSubtotal: "35000.00", // 10 * 3500
    tierType: "reseller"
  },
  {
    orderId: "ord_1",
    productId: "prod_detergente",
    variantId: "var_det_std",
    productName: "Detergente Magistral Plus",
    quantity: 5,
    unitPrice: "1400.00", // Con volumen? Supongamos 1400 (base es 1800)
    lineSubtotal: "7000.00",
    tierType: "reseller"
  },

  // Items para ord_2 (Retail)
  {
    orderId: "ord_2",
    productId: "prod_lavandina",
    variantId: "var_lav_1L",
    productName: "Lavandina Concentrada Limpiasol",
    variantName: "Envase 1 Litro",
    quantity: 2,
    unitPrice: "1200.00",
    lineSubtotal: "2400.00",
    tierType: "retail"
  },
  {
    orderId: "ord_2",
    productId: "prod_detergente",
    variantId: "var_det_std",
    productName: "Detergente Magistral Plus",
    quantity: 1,
    unitPrice: "2500.00",
    lineSubtotal: "2500.00",
    tierType: "retail"
  }
]
