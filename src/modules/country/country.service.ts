import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";

type NewCountry = {
  name: string;
  iso2Code: string;
  exportZoneCode: string;
  importZoneCode: string;
};

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

  getAdminCountries: async () => {
    return prisma.country.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        iso2Code: true,
        exportZoneCode: true,
        importZoneCode: true,
        isActive: true,
        deletedAt: true,
      },
    });
  },

  createCountry: async (payload: NewCountry, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const [exportZone, importZone] = await Promise.all([
        tx.rateZone.findUnique({ where: { code: payload.exportZoneCode }, select: { code: true } }),
        tx.rateZone.findUnique({ where: { code: payload.importZoneCode }, select: { code: true } }),
      ]);

      if (!exportZone || !importZone) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Choose valid export and import rate zones");
      }

      const created = await tx.country.create({ data: payload });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "COUNTRY_ADDED_TO_RATE_ZONE",
          entityType: "Country",
          entityId: created.id,
          after: toJson(created),
        },
      });
      return created;
    });
  },

  updateCountry: async (id: string, payload: Record<string, unknown>, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.country.findUnique({ where: { id } });
      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Country not found");
      }

      if (typeof payload.exportZoneCode === "string") {
        const zone = await tx.rateZone.findUnique({
          where: { code: payload.exportZoneCode },
          select: { code: true },
        });
        if (!zone) throw new ApiError(httpStatus.BAD_REQUEST, "Export rate zone does not exist");
      }
      if (typeof payload.importZoneCode === "string") {
        const zone = await tx.rateZone.findUnique({
          where: { code: payload.importZoneCode },
          select: { code: true },
        });
        if (!zone) throw new ApiError(httpStatus.BAD_REQUEST, "Import rate zone does not exist");
      }

      const data: Record<string, unknown> = {};
      if (typeof payload.exportZoneCode === "string") data.exportZoneCode = payload.exportZoneCode;
      if (typeof payload.importZoneCode === "string") data.importZoneCode = payload.importZoneCode;
      if (typeof payload.isActive === "boolean") {
        data.isActive = payload.isActive;
        data.deletedAt = payload.isActive ? null : new Date();
      }

      const after = await tx.country.update({ where: { id }, data: data as never });
      const action =
        payload.isActive === true
          ? "COUNTRY_RESTORED"
          : payload.isActive === false
            ? "COUNTRY_ARCHIVED"
            : "COUNTRY_RATE_ZONES_UPDATED";
      await tx.auditLog.create({
        data: {
          actorId,
          action,
          entityType: "Country",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });
      return after;
    });
  },

  archiveCountry: async (id: string, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.country.findUnique({ where: { id } });
      if (!before || before.deletedAt) {
        throw new ApiError(httpStatus.NOT_FOUND, "Active country not found");
      }

      const after = await tx.country.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: "COUNTRY_ARCHIVED",
          entityType: "Country",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });
      return after;
    });
  },
};