import { LRUCache } from "lru-cache"

import redisClient from "@/config/redis-client"

type CachedSession = {
  userId: string
  role: string
  expiresAt: number
}

const CACHE_TTL_SEC = 10

// L1 Cache: Memory local: max 1000 sessions in RAM. remove old automatically
const localCache = new LRUCache<string, CachedSession>({
  max: 1000,
  ttl: CACHE_TTL_SEC * 1000
})

export async function getCachedSession(sessionHash: string) {
  // 1. try L1 (Memory local) first (0ms)
  const local = localCache.get(sessionHash)
  if (local) return local

  // 2. fallback to L2 (Redis) (1-10ms)
  if (redisClient) {
    try {
      const data = await redisClient.get(`sess_cache:${sessionHash}`)
      if (data) {
        const parsed = JSON.parse(data) as CachedSession
        // saved in L1 for next immediate request
        localCache.set(sessionHash, parsed)
        return parsed
      }
    } catch (err) {
      console.warn("Redis cache get error:", err)
    }
  }
  return null
}

export async function setCachedSession(sessionHash: string, data: CachedSession) {
  // always to L1
  localCache.set(sessionHash, data)

  // set in Redis if available
  if (redisClient) {
    try {
      await redisClient.set(`sess_cache:${sessionHash}`, JSON.stringify(data), "EX", CACHE_TTL_SEC)
    } catch (err) {
      console.warn("Redis cache set error:", err)
    }
  }
}

export async function deleteCachedSession(sessionHash: string) {
  localCache.delete(sessionHash)

  if (redisClient) {
    try {
      await redisClient.del(`sess_cache:${sessionHash}`)
    } catch (err) {
      console.warn("Redis cache delete error:", err)
    }
  }
}
