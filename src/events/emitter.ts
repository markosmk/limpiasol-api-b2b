import EventEmitter from "node:events"

export const appEvents = new EventEmitter()

export const EventTypes = {
  USER_REGISTERED: "user.registered",
  PASSWORD_RESET_REQUESTED: "password.reset_requested",
  USER_WELCOME: "user.welcome"
  // ORDER_CREATED: "order.created",
} as const
