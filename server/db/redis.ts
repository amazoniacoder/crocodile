import { createClient } from "redis";
import type { RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let redisEnabled = true;

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!redisEnabled) {
    return null;
  }

  if (!redisClient) {
    try {
      const url = process.env.REDIS_URL || "redis://localhost:6379";

      redisClient = createClient({ url });

      redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err);
        if (err.code === "ECONNREFUSED") {
          console.warn("Redis connection failed. Disabling Redis cache.");
          redisEnabled = false;
          redisClient = null;
        }
      });

      await redisClient.connect();
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      redisEnabled = false;
      return null;
    }
  }

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    await client.ping();
    return true;
  } catch (error) {
    console.error("Redis connection check failed:", error);
    redisEnabled = false;
    return false;
  }
}

export function isRedisEnabled(): boolean {
  return redisEnabled;
}
