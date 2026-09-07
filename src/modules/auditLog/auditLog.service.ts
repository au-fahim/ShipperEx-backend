import { prisma } from "../../config/prisma.js";
import { getPagination } from "../../shared/pagination.js";

export const auditLogService = {
  getAuditLogs: async (query: unknown) => {
    const pagination = getPagination(query);
    const queryRecord = query as Record<string, string | undefined>;
    const where = {
      actorId: queryRecord.actorId,
      action: queryRecord.action,
      entityType: queryRecord.entityType,
      entityId: queryRecord.entityId,
    };

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },
};
