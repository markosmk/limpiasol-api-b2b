import { createHash, randomBytes } from "node:crypto"

export function generateSessionId() {
  return randomBytes(24).toString("hex")
}

export function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex")
}

type SessionExpiry = {
  days?: number
  hours?: number
  minutes?: number
}

export function createSessionExpiry({ days, hours, minutes }: SessionExpiry) {
  const date = new Date()
  date.setDate(date.getDate() + (days || 0))
  date.setHours(date.getHours() + (hours || 0))
  date.setMinutes(date.getMinutes() + (minutes || 0))
  return date
}
