import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";

export const shipmentRateService = {
  getRates: async (query: unknown) => {
    const pagination = getPagination(query);
    const queryRecord = query as Record<string, string | undefined>;
    const where = {
      deletedAt: null,
      direction: queryRecord.direction as never,
      shipmentType: queryRecord.shipmentType as never,
      zoneCode: queryRecord.zoneCode,
      isActive: queryRecord.isActive ? queryRecord.isActive === "true" : undefined,
    };

    const [data, total] = await Promise.all([
      prisma.shipmentRate.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ direction: "asc" }, { zoneCode: "asc" }, { minWeightKg: "asc" }],
        include: { zone: true },
      }),
      prisma.shipmentRate.count({ where }),
    ]);

    return {
      meta: { page: pagination.page, limit: pagination.limit, total },
      data,
    };
  },

  createRate: async (payload: Record<string, unknown>, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const zone = await tx.rateZone.findUnique({
        where: { code: payload.zoneCode as string },
        select: { code: true },
      });

      if (!zone) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Rate zone does not exist");
      }

      const created = await tx.shipmentRate.create({
        data: {
          direction: payload.direction as never,
          zoneCode: payload.zoneCode as string,
          shipmentType: payload.shipmentType as never,
          minWeightKg: payload.minWeightKg as never,
          maxWeightKg: (payload.maxWeightKg as never) ?? null,
          priceUsd: (payload.priceUsd as never) ?? null,
          perKgRateUsd: (payload.perKgRateUsd as never) ?? null,
          effectiveFrom: (payload.effectiveFrom as Date | undefined) ?? new Date(),
          effectiveTo: (payload.effectiveTo as Date | null | undefined) ?? null,
          isActive: (payload.isActive as boolean | undefined) ?? true,
          createdById: actorId,
          updatedById: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "SHIPMENT_RATE_CREATED",
          entityType: "ShipmentRate",
          entityId: created.id,
          after: toJson(created),
        },
      });

      return created;
    });
  },

  updateRate: async (id: string, payload: Record<string, unknown>, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.shipmentRate.findFirst({
        where: { id, deletedAt: null },
      });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Shipment rate not found");
      }

      const after = await tx.shipmentRate.update({
        where: { id },
        data: {
          ...payload,
          updatedById: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "SHIPMENT_RATE_UPDATED",
          entityType: "ShipmentRate",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    });
  },

  deleteRate: async (id: string, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.shipmentRate.findFirst({
        where: { id, deletedAt: null },
      });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Shipment rate not found");
      }

      const after = await tx.shipmentRate.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          updatedById: actorId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "SHIPMENT_RATE_DELETED",
          entityType: "ShipmentRate",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    });
  },
};
