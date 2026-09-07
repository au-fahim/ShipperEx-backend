import { prisma } from "../../config/prisma.js";

export const countryService = {
  getCountries: async (search?: string) => {
    return prisma.country.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        name: search ? { contains: search, mode: "insensitive" } : undefined,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        iso2Code: true,
        exportZoneCode: true,
        importZoneCode: true,
      },
    });
  },
};
