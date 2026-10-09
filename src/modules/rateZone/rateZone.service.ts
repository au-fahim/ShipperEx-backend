import { prisma } from "../../config/prisma.js";

export const rateZoneService = {
  getRateZones: async () => {
    return prisma.rateZone.findMany({
      orderBy: { code: "asc" },
      select: { code: true, name: true, description: true },
    });
  },
};