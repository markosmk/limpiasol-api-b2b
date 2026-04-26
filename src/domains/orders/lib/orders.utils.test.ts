// import { describe, expect, it } from "vitest"
// import {
//   calculateOrderTotals,
//   generateOrderCode,
//   getStatusTransitionError,
//   isValidPickupSchedule,
//   isValidStatusTransition
// } from "./orders.utils"
// import type { OrderStatus } from "../orders.types"

// describe("orders.utils", () => {
//   describe("generateOrderCode", () => {
//     it("genera código de 8 caracteres alfanuméricos", () => {
//       const code = generateOrderCode()
//       expect(code).toHaveLength(8)
//       expect(code).toMatch(/^[A-Z2-9]{8}$/) // Sin I, O, 0, 1
//     })

//     it("genera códigos diferentes en múltiples llamadas", () => {
//       const codes = new Set()
//       for (let i = 0; i < 100; i++) {
//         codes.add(generateOrderCode())
//       }
//       // Probabilidad de colisión es extremadamente baja: 32^8 combinaciones
//       expect(codes.size).toBeGreaterThan(95) // Permitimos <5 colisiones por azar
//     })
//   })

//   describe("isValidStatusTransition", () => {
//     const testCases: Array<{ from: OrderStatus; to: OrderStatus; expected: boolean }> = [
//       // Transiciones válidas
//       { from: "pending", to: "adjusting", expected: true },
//       { from: "pending", to: "pending_payment", expected: true },
//       { from: "pending", to: "cancelled", expected: true },
//       { from: "adjusting", to: "pending", expected: true },
//       { from: "adjusting", to: "pending_payment", expected: true },
//       { from: "pending_payment", to: "paid", expected: true },
//       { from: "paid", to: "shipped", expected: true },
//       { from: "paid", to: "ready_pickup", expected: true },
//       { from: "shipped", to: "delivered", expected: true },
//       { from: "ready_pickup", to: "delivered", expected: true },

//       // Transiciones inválidas
//       { from: "pending", to: "paid", expected: false }, // Salta paso intermedio
//       { from: "paid", to: "pending", expected: false }, // No se puede retroceder
//       { from: "delivered", to: "pending_payment", expected: false }, // Terminal
//       { from: "cancelled", to: "paid", expected: false }, // Terminal
//       { from: "shipped", to: "ready_pickup", expected: false } // Mutuamente excluyentes
//     ]

//     testCases.forEach(({ from, to, expected }) => {
//       it(`"${from}" → "${to}" debe ser ${expected ? "válido" : "inválido"}`, () => {
//         expect(isValidStatusTransition(from, to)).toBe(expected)
//       })
//     })
//   })

//   describe("getStatusTransitionError", () => {
//     it("retorna string vacío si la transición es válida", () => {
//       expect(getStatusTransitionError("pending", "pending_payment")).toBe("")
//     })

//     it("retorna mensaje descriptivo si la transición es inválida", () => {
//       const error = getStatusTransitionError("delivered", "pending")
//       expect(error).toContain("No se puede cambiar")
//       expect(error).toContain("delivered")
//       expect(error).toContain("pending")
//     })

//     it("maneja estado terminal sin transiciones válidas", () => {
//       const error = getStatusTransitionError("cancelled", "paid")
//       expect(error).toContain("ninguna") // VALID_TRANSITIONS["cancelled"] = []
//     })
//   })

//   describe("calculateOrderTotals", () => {
//     it("calcula totales básicos correctamente", () => {
//       const result = calculateOrderTotals({
//         lineSubtotals: ["100.00", "50.00", "25.50"],
//         discounts: "10.00",
//         shippingCost: "15.00",
//         taxes: "20.00"
//       })
//       expect(result.subtotal).toBe("175.50") // 100 + 50 + 25.50
//       expect(result.discounts).toBe("10.00")
//       expect(result.shippingCost).toBe("15.00")
//       expect(result.taxes).toBe("20.00")
//       expect(result.total).toBe("200.50") // 175.50 - 10 + 15 + 20
//     })

//     it("maneja valores por defecto (undefined)", () => {
//       const result = calculateOrderTotals({
//         lineSubtotals: ["100.00"]
//       })
//       expect(result.discounts).toBe("0.00")
//       expect(result.shippingCost).toBe("0.00")
//       expect(result.taxes).toBe("0.00")
//       expect(result.total).toBe("100.00")
//     })

//     it("maneja descuentos mayores que subtotal (total negativo no permitido en negocio, pero función es pura)", () => {
//       const result = calculateOrderTotals({
//         lineSubtotals: ["50.00"],
//         discounts: "100.00"
//       })
//       expect(result.total).toBe("-50.00") // La validación de negocio debe hacerse en el service
//     })

//     it("redondea a 2 decimales correctamente", () => {
//       const result = calculateOrderTotals({
//         lineSubtotals: ["33.333", "66.667"], // Suma = 100.00 exacto
//         taxes: "21.005" // Debería redondear a 21.01
//       })
//       expect(result.subtotal).toBe("100.00")
//       expect(result.taxes).toBe("21.01")
//       expect(result.total).toBe("121.01")
//     })
//   })

//   describe("isValidPickupSchedule", () => {
//     it("acepta fecha/hora futura válida", () => {
//       const futureDate = new Date(Date.now() + 86400000) // Mañana
//       const dateStr = futureDate.toISOString().split("T")[0] // "YYYY-MM-DD"
//       expect(isValidPickupSchedule(dateStr, "14:30")).toBe(true)
//     })

//     it("rechaza fecha en el pasado", () => {
//       const pastDate = new Date(Date.now() - 86400000) // Ayer
//       const dateStr = pastDate.toISOString().split("T")[0]
//       expect(isValidPickupSchedule(dateStr, "10:00")).toBe(false)
//     })

//     it("rechaza formato de fecha inválido", () => {
//       expect(isValidPickupSchedule("2024/02/15", "14:30")).toBe(false)
//       expect(isValidPickupSchedule("15-02-2024", "14:30")).toBe(false)
//     })

//     it("rechaza formato de hora inválido", () => {
//       expect(isValidPickupSchedule("2024-02-15", "2:30 PM")).toBe(false)
//       expect(isValidPickupSchedule("2024-02-15", "25:00")).toBe(false)
//       expect(isValidPickupSchedule("2024-02-15", "14:60")).toBe(false)
//     })

//     it("acepta hora 00:00 y 23:59 (límites válidos)", () => {
//       const futureDate = new Date(Date.now() + 86400000)
//       const dateStr = futureDate.toISOString().split("T")[0]
//       expect(isValidPickupSchedule(dateStr, "00:00")).toBe(true)
//       expect(isValidPickupSchedule(dateStr, "23:59")).toBe(true)
//     })
//   })
// })
