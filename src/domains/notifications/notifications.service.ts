import type { EmailModule } from "@/utils/modules/email/email.module"
import type { NotificationsSettingsInput, StoreSettingsInput } from "../admin/admin.schema"
import type { OrderNotification } from "./notifications.types"

import { type AdminService, adminService } from "@/domains/admin/admin.service"
import { emailModule } from "@/utils/modules/email/email.module"

export class NotificationService {
  constructor(
    private settingsService: AdminService,
    private emailService: EmailModule
  ) {}
  /**
   * 1. Pedido Creado (Intención de compra)
   */
  async notifyNewOrder(order: OrderNotification, customerEmail: string) {
    try {
      // Notificar al cliente
      await this.emailService.sendTransactionalEmail({
        to: customerEmail,
        templateKey: "orderCreated",
        templateParams: {
          orderCode: order.orderCode,
          total: order.total
        }
      })

      // Leer settings para ver si notificamos a los admins
      const notySettings = (await this.settingsService.getAllSettings(
        "notifications"
      )) as NotificationsSettingsInput
      const adminEmails = notySettings?.notificationsRecipients as string[] | undefined

      if (notySettings?.notifications?.notifyOnNewOrder && adminEmails && adminEmails.length > 0) {
        await this.emailService.sendTransactionalEmail({
          to: adminEmails,
          templateKey: "orderCreated",
          templateParams: {
            orderCode: order.orderCode,
            total: order.total
          }
        })
      }
    } catch (error) {
      console.error(
        `[NotificationService] Falló email de creación para orden ${order.orderCode}:`,
        error
      )
    }
  }

  /**
   * 2. Esperando Pago (Cotización final cerrada)
   */
  async notifyPaymentRequired(order: OrderNotification, customerEmail: string, adminNote?: string) {
    try {
      const storeSettings = (await this.settingsService.getAllSettings(
        "store"
      )) as StoreSettingsInput
      const paymentInstructions =
        storeSettings?.paymentInstructions || "Por favor contactate para coordinar el pago."

      await this.emailService.sendTransactionalEmail({
        to: customerEmail,
        templateKey: "orderPendingPayment",
        templateParams: {
          orderCode: order.orderCode,
          total: order.total,
          paymentInstructions,
          adminNote
        }
      })
    } catch (error) {
      console.error(
        `[NotificationService] Falló email de pago requerido para orden ${order.orderCode}:`,
        error
      )
    }
  }

  /**
   * 3. Pago Confirmado
   */
  async notifyOrderPaid(order: OrderNotification, customerEmail: string) {
    try {
      await this.emailService.sendTransactionalEmail({
        to: customerEmail,
        templateKey: "orderPaid",
        templateParams: {
          orderCode: order.orderCode
        }
      })
    } catch (error) {
      console.error(
        `[NotificationService] Falló email de pago confirmado para orden ${order.orderCode}:`,
        error
      )
    }
  }

  /**
   * 4. Despachado o Listo para Retiro
   */
  async notifyOrderDispatched(
    order: OrderNotification,
    customerEmail: string,
    trackingNumber?: string
  ) {
    try {
      const templateParams: Record<string, unknown> = {
        orderCode: order.orderCode,
        deliveryType: order.deliveryType
      }

      // Si es pickup, extraemos los datos de la sucursal de la orden
      if (order.deliveryType === "pickup" && order.pickupLocationData) {
        templateParams.pickupLocationName = order.pickupLocationData.locationName
        templateParams.pickupAddress = order.pickupLocationData.address
      } else {
        // Si es envío, pasamos el tracking
        templateParams.trackingNumber = trackingNumber
      }

      await this.emailService.sendTransactionalEmail({
        to: customerEmail,
        templateKey: "orderDispatched",
        templateParams
      })
    } catch (error) {
      console.error(
        `[NotificationService] Falló email de despacho para orden ${order.orderCode}:`,
        error
      )
    }
  }

  /**
   * 5. Cancelación
   */
  async notifyOrderCancelled(order: OrderNotification, customerEmail: string, reason?: string) {
    try {
      await this.emailService.sendTransactionalEmail({
        to: customerEmail,
        templateKey: "orderCancelled",
        templateParams: {
          orderCode: order.orderCode,
          reason
        }
      })
    } catch (error) {
      console.error(
        `[NotificationService] Falló email de cancelación para orden ${order.orderCode}:`,
        error
      )
    }
  }

  /** Auth */

  async notifyUserRegistered(email: string, verificationToken: string) {
    const baseUrl = process.env.APP_URL || "http://localhost:3000"
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`

    try {
      await this.emailService.sendTransactionalEmail({
        to: email,
        templateKey: "userRegistered",
        templateParams: {
          verificationUrl
        }
      })
    } catch (error) {
      console.error(`[NotificationService] Falló email de registro para ${email}:`, error)
    }
  }

  async notifyPasswordReset(email: string, resetToken: string) {
    const baseUrl = process.env.APP_URL || "http://localhost:3000"
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`
    try {
      await this.emailService.sendTransactionalEmail({
        to: email,
        templateKey: "passwordReset",
        templateParams: {
          resetUrl
        }
      })
    } catch (error) {
      console.error(
        `[NotificationService] Falló email de recuperación de contraseña para ${email}:`,
        error
      )
    }
  }

  async notifyWelcomeEmail(email: string, name?: string) {
    const siteUrl = process.env.APP_URL || "http://localhost:3000"
    try {
      await this.emailService.sendTransactionalEmail({
        to: email,
        templateKey: "welcome",
        templateParams: {
          siteUrl,
          name
        }
      })
    } catch (error) {
      console.error(`[NotificationService] Falló email de bienvenida para ${email}:`, error)
    }
  }
}

export const notificationService = new NotificationService(adminService, emailModule)
