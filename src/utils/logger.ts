import type { LoggerOptions } from "pino"

export const loggerOptions: LoggerOptions = {
  redact: ["DATABASE_CONNECTION"],
  level: "debug",
  transport: {
    target: "pino-pretty"
  }
}
