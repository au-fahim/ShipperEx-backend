import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { redis } from "./config/redis.js";

const server = app.listen(env.PORT, () => {
  console.log(`ShipperEx API listening on port ${env.PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`${signal} received. Closing server...`);
  server.close(async () => {
    await prisma.$disconnect();
    if (redis) {
      redis.disconnect();
    }
    process.exit(0);
  });
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
