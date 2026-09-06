import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis =
  env.REDIS_ENABLED && env.REDIS_URL && env.NODE_ENV !== "test"
    ? new Redis(env.REDIS_URL, {
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: () => null,
      })
    : null;

redis?.on("error", (error: Error) => {
  console.warn(`Redis unavailable: ${error.message}`);
});
