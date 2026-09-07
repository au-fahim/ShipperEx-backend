import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import type { Role, UserStatus } from "../../generated/prisma/enums.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  phone: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
  staffProfile: {
    select: {
      id: true,
      staffType: true,
      hubId: true,
      availabilityStatus: true,
      activeTaskCount: true,
      maxActiveTasks: true,
    },
  },
} as const;

export const userService = {
  getMe: async (userId: string) => {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: publicUserSelect,
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    return user;
  },

  updateMe: async (
    userId: string,
    payload: { name?: string; phone?: string; avatarUrl?: string },
  ) => {
    return prisma.user.update({
      where: { id: userId },
      data: payload,
      select: publicUserSelect,
    });
  },

  getUsers: async (query: unknown) => {
    const pagination = getPagination(query);
    const where = {
      deletedAt: null,
      OR: pagination.search
        ? [
            { name: { contains: pagination.search, mode: "insensitive" as const } },
            { email: { contains: pagination.search, mode: "insensitive" as const } },
          ]
        : undefined,
    };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        select: publicUserSelect,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
      },
      data,
    };
  },

  getUserById: async (id: string) => {
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: publicUserSelect,
    });

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found");
    }

    return user;
  },

  updateUserStatus: async (id: string, status: UserStatus, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: publicUserSelect,
      });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found");
      }

      const after = await tx.user.update({
        where: { id },
        data: { status },
        select: publicUserSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_STATUS_UPDATED",
          entityType: "User",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    });
  },

  updateUserRole: async (id: string, role: Role, actorId: string) => {
    return prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({
        where: { id, deletedAt: null },
        select: publicUserSelect,
      });

      if (!before) {
        throw new ApiError(httpStatus.NOT_FOUND, "User not found");
      }

      if (role === "STAFF" && !before.staffProfile) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Create Manager and Courier accounts through the staff provisioning endpoints",
        );
      }

      if (before.role === "STAFF" && role !== "STAFF") {
        throw new ApiError(httpStatus.BAD_REQUEST, "Staff roles cannot be changed directly");
      }

      const after = await tx.user.update({
        where: { id },
        data: { role },
        select: publicUserSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: "USER_ROLE_UPDATED",
          entityType: "User",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });

      return after;
    });
  },
};
