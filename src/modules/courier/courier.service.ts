import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import { CourierAvailabilityStatus, Role, StaffType } from "../../generated/prisma/enums.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";
import { hashPassword } from "../auth/auth.utils.js";

type AuthUser = NonNullable<Express.Request["user"]>;

type StaffAccountInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
  hubId: string;
};

const staffSelect = {
  id: true,
  staffType: true,
  availabilityStatus: true,
  activeTaskCount: true,
  maxActiveTasks: true,
  earningsBalanceUsd: true,
  totalDeliveries: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { id: true, name: true, email: true, phone: true, status: true },
  },
  hub: { include: { country: true } },
} as const;

const createStaff = async (payload: StaffAccountInput, staffType: StaffType, actorId: string) => {
  const [hub, existingUser] = await Promise.all([
    prisma.hub.findFirst({
      where: { id: payload.hubId, deletedAt: null, isActive: true },
      select: { id: true },
    }),
    prisma.user.findUnique({ where: { email: payload.email }, select: { id: true } }),
  ]);

  if (!hub) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Active hub not found");
  }

  if (existingUser) {
    throw new ApiError(httpStatus.CONFLICT, "User already exists with this email");
  }

  const passwordHash = await hashPassword(payload.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash,
        phone: payload.phone,
        role: Role.STAFF,
      },
    });

    const staffProfile = await tx.staffProfile.create({
      data: {
        userId: user.id,
        hubId: payload.hubId,
        staffType,
        availabilityStatus:
          staffType === StaffType.COURIER ? CourierAvailabilityStatus.AVAILABLE : undefined,
      },
      select: staffSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: `${staffType}_ACCOUNT_CREATED`,
        entityType: "StaffProfile",
        entityId: staffProfile.id,
        after: toJson(staffProfile),
      },
    });

    return staffProfile;
  });
};

export const courierService = {
  createManager: (payload: StaffAccountInput, actorId: string) =>
    createStaff(payload, StaffType.MANAGER, actorId),

  createCourier: (payload: StaffAccountInput, actorId: string) =>
    createStaff(payload, StaffType.COURIER, actorId),

  getCouriers: async (query: unknown, actor: AuthUser) => {
    const pagination = getPagination(query);
    const queryRecord = query as Record<string, string | undefined>;
    const hubId = actor.role === Role.ADMIN ? queryRecord.hubId : actor.hubId;
    const where = {
      deletedAt: null,
      staffType: StaffType.COURIER,
      hubId,
      availabilityStatus: queryRecord.availabilityStatus as CourierAvailabilityStatus | undefined,
      user: {
        deletedAt: null,
        OR: pagination.search
          ? [
              { name: { contains: pagination.search, mode: "insensitive" as const } },
              { email: { contains: pagination.search, mode: "insensitive" as const } },
              { phone: { contains: pagination.search, mode: "insensitive" as const } },
            ]
          : undefined,
      },
    };

    const [data, total] = await Promise.all([
      prisma.staffProfile.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ activeTaskCount: "asc" }, { createdAt: "asc" }],
        select: staffSelect,
      }),
      prisma.staffProfile.count({ where }),
    ]);

    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },

  updateCourier: async (
    id: string,
    payload: {
      name?: string;
      phone?: string;
      hubId?: string;
      availabilityStatus?: CourierAvailabilityStatus;
    },
    actor: AuthUser,
  ) =>
    prisma.$transaction(async (tx) => {
      const before = await tx.staffProfile.findFirst({
        where: {
          id,
          deletedAt: null,
          staffType: StaffType.COURIER,
          hubId: actor.role === Role.ADMIN ? undefined : actor.hubId,
        },
        select: staffSelect,
      });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Courier not found in your hub");
      }

      if (payload.hubId && actor.role !== Role.ADMIN) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Only Admin can transfer a courier to another hub",
        );
      }

      if (payload.hubId && before.activeTaskCount > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Courier with active tasks cannot change hubs");
      }

      if (payload.hubId) {
        const hub = await tx.hub.findFirst({
          where: { id: payload.hubId, deletedAt: null, isActive: true },
          select: { id: true },
        });
        if (!hub) {
          throw new ApiError(httpStatus.BAD_REQUEST, "Active hub not found");
        }
      }

      if (
        payload.availabilityStatus === CourierAvailabilityStatus.AVAILABLE &&
        before.activeTaskCount >= before.maxActiveTasks
      ) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Courier is at task capacity");
      }

      if (payload.name || payload.phone) {
        await tx.user.update({
          where: { id: before.user.id },
          data: { name: payload.name, phone: payload.phone },
        });
      }

      const after = await tx.staffProfile.update({
        where: { id },
        data: {
          hubId: payload.hubId,
          availabilityStatus: payload.availabilityStatus,
        },
        select: staffSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "COURIER_UPDATED",
          entityType: "StaffProfile",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    }),

  deleteCourier: async (id: string, actorId: string) =>
    prisma.$transaction(async (tx) => {
      const before = await tx.staffProfile.findFirst({
        where: { id, deletedAt: null, staffType: StaffType.COURIER },
        select: staffSelect,
      });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "Courier not found");
      }

      if (before.activeTaskCount > 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Courier with active tasks cannot be deleted");
      }

      const now = new Date();
      const after = await tx.staffProfile.update({
        where: { id },
        data: { deletedAt: now, availabilityStatus: CourierAvailabilityStatus.SUSPENDED },
        select: staffSelect,
      });
      await tx.user.update({ where: { id: before.user.id }, data: { deletedAt: now } });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "COURIER_DELETED",
          entityType: "StaffProfile",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    }),
};
