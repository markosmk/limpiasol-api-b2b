import { notificationService } from "@/domains/notifications/notifications.service"
import { appEvents, EventTypes } from "@/events/emitter"

appEvents.on(EventTypes.USER_REGISTERED, async (payload) => {
  try {
    await notificationService.notifyUserRegistered(payload.email, payload.verificationToken)
  } catch (error) {
    console.error("Falló el envío del email de verificación", error)
  }
})

appEvents.on(EventTypes.PASSWORD_RESET_REQUESTED, async (payload) => {
  try {
    await notificationService.notifyPasswordReset(payload.email, payload.resetToken)
  } catch (error) {
    console.error("Falló el envío del email de recuperación de contraseña", error)
  }
})

appEvents.on(EventTypes.USER_WELCOME, async (payload) => {
  try {
    await notificationService.notifyWelcomeEmail(payload.email, payload.name)
  } catch (error) {
    console.error("Falló el envío del email de bienvenida", error)
  }
})
