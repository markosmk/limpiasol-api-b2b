// unit testing

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NotificationService } from "./notifications.service"
import type { OrderNotification } from "./notifications.types"

//mockeamos las dependencias
const mockEmailModule = {
  sendTransactionalEmail: vi.fn().mockResolvedValue({ success: true })
}

const mockAdminService = {
  getAllSettings: vi.fn()
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation instance with mocks>
const notificationService = new NotificationService(mockAdminService as any, mockEmailModule as any)

describe("NotificationService", () => {
  const mockOrder: OrderNotification = {
    orderCode: "TEST-123",
    total: "5000.00",
    deliveryType: "shipping",
    pickupLocationData: null
  }

  const customerEmail = "cliente@test.com"

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("notifyNewOrder", () => {
    it("debe enviar correo al cliente siempre", async () => {
      // Setup: El admin service no devuelve correos de admin
      mockAdminService.getAllSettings.mockResolvedValueOnce(null)

      await notificationService.notifyNewOrder(mockOrder, customerEmail)

      // Assert: Se llamó al módulo de email 1 sola vez (para el cliente)
      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledWith({
        to: customerEmail,
        templateKey: "orderCreated",
        templateParams: {
          orderCode: mockOrder.orderCode,
          total: mockOrder.total
        }
      })
    })

    it("debe enviar correo a los admins si está habilitado en los settings", async () => {
      // Setup: Simulamos que la BD tiene configurados correos de admin
      mockAdminService.getAllSettings.mockResolvedValueOnce({
        notificationsRecipients: ["admin1@test.com", "admin2@test.com"],
        notifications: { notifyOnNewOrder: true }
      })

      await notificationService.notifyNewOrder(mockOrder, customerEmail)

      // Assert: Se llamó 2 veces (1 cliente, 1 array de admins)
      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledTimes(2)

      // Verificamos la llamada al admin
      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenNthCalledWith(2, {
        to: ["admin1@test.com", "admin2@test.com"],
        templateKey: "orderCreated",
        templateParams: {
          orderCode: mockOrder.orderCode,
          total: mockOrder.total
        }
      })
    })

    it("NO debe enviar correo a admins si notifyOnNewOrder es false", async () => {
      mockAdminService.getAllSettings.mockResolvedValueOnce({
        notificationsRecipients: ["admin@test.com"],
        notifications: { notifyOnNewOrder: false } // Desactivado
      })

      await notificationService.notifyNewOrder(mockOrder, customerEmail)

      // Assert: Solo 1 llamada (cliente)
      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledTimes(1)
    })
  })

  describe("notifyPaymentRequired", () => {
    it("debe enviar instrucciones de pago obtenidas de la DB", async () => {
      // Setup: Simulamos los store settings
      mockAdminService.getAllSettings.mockResolvedValueOnce({
        paymentInstructions: "Alias: MITIENDA.MP"
      })

      await notificationService.notifyPaymentRequired(mockOrder, customerEmail, "Nota extra")

      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledWith({
        to: customerEmail,
        templateKey: "orderPendingPayment",
        templateParams: {
          orderCode: mockOrder.orderCode,
          total: mockOrder.total,
          paymentInstructions: "Alias: MITIENDA.MP",
          adminNote: "Nota extra"
        }
      })
    })

    it("debe usar instrucciones por defecto si no hay nada en DB", async () => {
      mockAdminService.getAllSettings.mockResolvedValueOnce({})

      await notificationService.notifyPaymentRequired(mockOrder, customerEmail)

      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateParams: expect.objectContaining({
            paymentInstructions: "Por favor contactate para coordinar el pago."
          })
        })
      )
    })
  })

  describe("notifyOrderDispatched", () => {
    it("debe enviar datos de tracking si es deliveryType shipping", async () => {
      await notificationService.notifyOrderDispatched(mockOrder, customerEmail, "TRACK-999")

      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateKey: "orderDispatched",
          templateParams: {
            orderCode: mockOrder.orderCode,
            deliveryType: "shipping",
            trackingNumber: "TRACK-999"
          }
        })
      )
    })

    it("debe enviar datos de sucursal si es deliveryType pickup", async () => {
      const pickupOrder: OrderNotification = {
        ...mockOrder,
        deliveryType: "pickup",
        pickupLocationData: {
          locationName: "Sucursal Centro",
          address: "Av 123"
        }
      }

      await notificationService.notifyOrderDispatched(pickupOrder, customerEmail)

      expect(mockEmailModule.sendTransactionalEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateParams: expect.objectContaining({
            deliveryType: "pickup",
            pickupLocationName: "Sucursal Centro",
            pickupAddress: "Av 123"
          })
        })
      )
    })
  })
})
