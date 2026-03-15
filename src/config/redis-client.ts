import { Redis } from "ioredis"
import { env } from "./env"

const redisClient = env.REDIS_URL ? new Redis(env.REDIS_URL) : null

if (redisClient) {
  redisClient.on("error", (err) => {
    console.warn("Redis client error:", err)
  })
}

export default redisClient
