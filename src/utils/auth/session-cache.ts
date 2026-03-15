import redisClient from "@/config/redis-client"

type CachedSession = {
  userId: string
  role: string
  expiresAt: number
}

const localCache = new Map<string, CachedSession & { cacheExpires: number }>()
const CACHE_TTL_SEC = 10

export async function getCachedSession(sessionHash: string) {
  // Try Redis first
  if (redisClient) {
    try {
      const data = await redisClient.get(`sess_cache:${sessionHash}`)
      if (data) return JSON.parse(data) as CachedSession
    } catch (err) {
      console.warn("Redis cache get error:", err)
    }
  }

  // Fallback to local cache
  const cached = localCache.get(sessionHash)
  if (!cached) return null

  if (cached.cacheExpires < Date.now()) {
    localCache.delete(sessionHash)
    return null
  }

  return cached
}

export async function setCachedSession(sessionHash: string, data: CachedSession) {
  // Set in Redis if available
  if (redisClient) {
    try {
      await redisClient.set(`sess_cache:${sessionHash}`, JSON.stringify(data), "EX", CACHE_TTL_SEC)
    } catch (err) {
      console.warn("Redis cache set error:", err)
    }
  }

  // Always set in local cache as fallback
  localCache.set(sessionHash, {
    ...data,
    cacheExpires: Date.now() + CACHE_TTL_SEC * 1000
  })
}

export async function deleteCachedSession(sessionHash: string) {
  if (redisClient) {
    try {
      await redisClient.del(`sess_cache:${sessionHash}`)
    } catch (err) {
      console.warn("Redis cache delete error:", err)
    }
  }
  localCache.delete(sessionHash)
}

// clear cache periodically
// setInterval(() => {
//   const now = Date.now()

//   for (const [key, value] of cache.entries()) {
//     if (value.cacheExpires < now) {
//       cache.delete(key)
//     }
//   }

// }, 60000)
