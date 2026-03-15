import { appEvents, EventTypes } from "../emitter"

import { emailService } from "@/utils/email/email.service"

appEvents.on(EventTypes.USER_REGISTERED, async (payload) => {
  try {
    await emailService.sendVerificationEmail(payload.email, payload.verificationToken)
  } catch (error) {
    console.error("Falló el envío del email de verificación", error)
  }
})

appEvents.on(EventTypes.PASSWORD_RESET_REQUESTED, async (payload) => {
  try {
    await emailService.sendPasswordResetEmail(payload.email, payload.resetToken)
  } catch (error) {
    console.error("Falló el envío del email de recuperación de contraseña", error)
  }
})
