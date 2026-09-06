import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export const runSerializableTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;

      if ((error as { code?: string }).code !== "P2034") {
        throw error;
      }
    }
  }

  throw lastError;
};
