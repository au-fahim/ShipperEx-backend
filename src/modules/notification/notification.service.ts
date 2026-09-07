import { prisma } from "../../config/prisma.js";
import { getPagination } from "../../shared/pagination.js";

export const notificationService = {
  getMyNotifications: async (query: unknown, userId: string) => {
    const pagination = getPagination(query);

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },

  markAsRead: async (id: string, userId: string) => {
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  },
};
