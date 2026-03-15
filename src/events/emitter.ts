import EventEmitter from "node:events"

export const appEvents = new EventEmitter()

export const EventTypes = {
  USER_REGISTERED: "user.registered",
  ORDER_CREATED: "order.created",
  PASSWORD_RESET_REQUESTED: "password.reset_requested"
} as const
