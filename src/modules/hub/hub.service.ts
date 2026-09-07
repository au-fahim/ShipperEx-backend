import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";

export const hubService = {
  createHub: async (payload: Record<string, unknown>, actorId: string) => {
    const country = await prisma.country.findFirst({
      where: { id: payload.countryId as string, deletedAt: null, isActive: true },
      select: { id: true },
    });

    if (!country) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Active country not found");
    }

    const hub = await prisma.hub.create({
      data: payload as never,
      include: { country: true },
    });

    await prisma.auditLog.create({
      data: {
        actorId,
        action: "HUB_CREATED",
        entityType: "Hub",
        entityId: hub.id,
        after: toJson(hub),
      },
    });

    return hub;
  },

  getHubs: async (query: unknown) => {
    const pagination = getPagination(query);
    const queryRecord = query as Record<string, string | undefined>;
    const where = {
      deletedAt: null,
      isActive: queryRecord.isActive ? queryRecord.isActive === "true" : undefined,
      OR: pagination.search
        ? [
            { name: { contains: pagination.search, mode: "insensitive" as const } },
            { code: { contains: pagination.search, mode: "insensitive" as const } },
            { city: { contains: pagination.search, mode: "insensitive" as const } },
            { country: { name: { contains: pagination.search, mode: "insensitive" as const } } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      prisma.hub.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        include: { country: true },
      }),
      prisma.hub.count({ where }),
    ]);

    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },

  updateHub: async (id: string, payload: Record<string, unknown>, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.hub.findFirst({ where: { id, deletedAt: null } });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Hub not found");
      }

      if (payload.countryId) {
        const country = await tx.country.findFirst({
          where: { id: payload.countryId as string, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!country) {
          throw new ApiError(httpStatus.BAD_REQUEST, "Active country not found");
        }
      }

      const after = await tx.hub.update({
        where: { id },
        data: payload as never,
        include: { country: true },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "HUB_UPDATED",
          entityType: "Hub",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    });
  },

  deleteHub: async (id: string, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.hub.findFirst({ where: { id, deletedAt: null } });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Hub not found");
      }

      const after = await tx.hub.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "HUB_DELETED",
          entityType: "Hub",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    });
  },
};
