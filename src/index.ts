import path from "node:path"
import AutoLoad from "@fastify/autoload"
import closeWithGrace from "close-with-grace"
import fastify from "fastify"
import { loggerOptions } from "./utils/logger"

import "./events/listeners/email.listener"

const PORT = parseInt(process.env.PORT ?? "8080", 10)

async function main() {
  const app = fastify({
    logger: loggerOptions
  })

  app.register(AutoLoad, {
    dir: path.join(__dirname, "plugins")
  })

  app.register(AutoLoad, {
    dir: path.join(__dirname, "domains"),
    scriptPattern: /index\.ts$/,
    ignorePattern: /.*\.test\.ts$/
  })

  // Graceful shutdown
  closeWithGrace({ delay: 500 }, async ({ err }) => {
    if (err) app.log.error(err)
    await app.close()
  })

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" })
    app.log.info(`Server running at http://0.0.0.0:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
