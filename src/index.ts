import path from "node:path"
import AutoLoad from "@fastify/autoload"
import fastify from "fastify"
import { loggerOptions } from "./utils/logger"

import "./events/listeners/email.listener"

const app = fastify({
  logger: loggerOptions
})

app.register(AutoLoad, {
  dir: path.join(__dirname, "plugins")
})

app.register(AutoLoad, {
  dir: path.join(__dirname, "domains")
})

const PORT = parseInt(process.env.PORT ?? "", 10) || 8080
app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})
