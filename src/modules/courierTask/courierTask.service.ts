import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  CourierAvailabilityStatus,
  CourierTaskStatus,
  CourierTaskType,
  ShipmentPurpose,
  ShipmentStatus,
} from "../../generated/prisma/enums.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";
import { runSerializableTransaction } from "../../shared/transaction.js";
import { invalidateTrackingCache } from "../shipment/shipment.service.js";

type AuthUser = NonNullable<Express.Request["user"]>;

const taskInclude = {
  hub: { include: { country: true } },
  courierProfile: { select: { id: true, user: { select: { id: true, name: true } } } },
  shipment: {
    include: {
      originCountry: true,
      destinationCountry: true,
      originHub: { include: { country: true } },
      destinationHub: { include: { country: true } },
    },
  },
} as const;

const releaseCapacity = async (tx: Prisma.TransactionClient, courierProfileId: string) => {
  await tx.staffProfile.updateMany({
    where: { id: courierProfileId, activeTaskCount: { gt: 0 } },
    data: { activeTaskCount: { decrement: 1 } },
  });
  await tx.staffProfile.updateMany({
    where: {
      id: courierProfileId,
      activeTaskCount: { lt: 5 },
      availabilityStatus: CourierAvailabilityStatus.AT_CAPACITY,
    },
    data: { availabilityStatus: CourierAvailabilityStatus.AVAILABLE },
  });
};

const getOwnedTask = async (
  tx: Prisma.TransactionClient,
  id: string,
  actor: AuthUser,
  status?: CourierTaskStatus,
) => {
  const task = await tx.courierTask.findFirst({
    where: {
      id,
      courierProfileId: actor.staffProfileId,
      status,
    },
    include: taskInclude,
  });
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Courier task not found");
  return task;
};

export const courierTaskService = {
  getMyTasks: async (query: unknown, actor: AuthUser) => {
    const pagination = getPagination(query);
    const queryRecord = query as Record<string, string | undefined>;
    const where = {
      courierProfileId: actor.staffProfileId,
      status: queryRecord.status as CourierTaskStatus | undefined,
      taskType: queryRecord.taskType as CourierTaskType | undefined,
    };
    const [data, total] = await Promise.all([
      prisma.courierTask.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { assignedAt: "desc" },
        include: taskInclude,
      }),
      prisma.courierTask.count({ where }),
    ]);
    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },

  getTask: async (id: string, actor: AuthUser) => {
    const task = await prisma.courierTask.findFirst({
      where: { id, courierProfileId: actor.staffProfileId },
      include: taskInclude,
    });
    if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Courier task not found");
    return task;
  },

  startTask: async (id: string, note: string | undefined, actor: AuthUser) => {
    const result = await runSerializableTransaction(async (tx) => {
      const before = await getOwnedTask(tx, id, actor, CourierTaskStatus.ASSIGNED);
      const expectedShipmentStatus =
        before.taskType === CourierTaskType.PICKUP
          ? ShipmentStatus.PICKUP_ASSIGNED
          : ShipmentStatus.DELIVERY_ASSIGNED;
      if (before.shipment.status !== expectedShipmentStatus) {
        throw new ApiError(httpStatus.CONFLICT, "Shipment is not ready for this task");
      }

      const task = await tx.courierTask.update({
        where: { id },
        data: { status: CourierTaskStatus.IN_PROGRESS, startedAt: new Date(), note },
        include: taskInclude,
      });
      const shipmentStatus =
        before.taskType === CourierTaskType.DELIVERY
          ? ShipmentStatus.OUT_FOR_DELIVERY
          : ShipmentStatus.PICKUP_ASSIGNED;
      if (before.taskType === CourierTaskType.DELIVERY) {
        await tx.shipment.update({
          where: { id: before.shipmentId },
          data: { status: ShipmentStatus.OUT_FOR_DELIVERY },
        });
      }
      await tx.trackingEvent.create({
        data: {
          shipmentId: before.shipmentId,
          status: shipmentStatus,
          location: before.hub.name,
          note: note ?? `${before.taskType} task started`,
          createdById: actor.userId,
        },
      });
      return task;
    });
    await invalidateTrackingCache(result.shipment.trackingNumber);
    return result;
  },

  completeTask: async (
    id: string,
    payload: { location?: string; note?: string },
    actor: AuthUser,
  ) => {
    const result = await runSerializableTransaction(async (tx) => {
      const before = await getOwnedTask(tx, id, actor, CourierTaskStatus.IN_PROGRESS);
      const isPickup = before.taskType === CourierTaskType.PICKUP;
      const expectedStatus = isPickup
        ? ShipmentStatus.PICKUP_ASSIGNED
        : ShipmentStatus.OUT_FOR_DELIVERY;
      if (before.shipment.status !== expectedStatus) {
        throw new ApiError(httpStatus.CONFLICT, "Shipment is not in the expected task state");
      }

      const nextStatus = isPickup ? ShipmentStatus.PICKED_UP : ShipmentStatus.DELIVERED;
      const task = await tx.courierTask.update({
        where: { id },
        data: {
          status: CourierTaskStatus.COMPLETED,
          completedAt: new Date(),
          note: payload.note,
        },
        include: taskInclude,
      });
      await tx.shipment.update({
        where: { id: before.shipmentId },
        data: {
          status: nextStatus,
          pickedUpAt: isPickup ? new Date() : undefined,
          deliveredAt: isPickup ? undefined : new Date(),
        },
      });
      await releaseCapacity(tx, before.courierProfileId);

      if (!isPickup) {
        const earningAmount = Number(before.shipment.priceUsd) * 0.1;
        await tx.staffProfile.update({
          where: { id: before.courierProfileId },
          data: {
            totalDeliveries: { increment: 1 },
            earningsBalanceUsd: { increment: earningAmount },
          },
        });
        await tx.courierEarning.create({
          data: {
            staffProfileId: before.courierProfileId,
            courierTaskId: before.id,
            amountUsd: earningAmount,
          },
        });
      }

      await tx.trackingEvent.create({
        data: {
          shipmentId: before.shipmentId,
          status: nextStatus,
          location: payload.location ?? before.hub.name,
          note: payload.note ?? `${before.taskType} task completed`,
          createdById: actor.userId,
        },
      });
      await tx.notification.create({
        data: {
          userId: before.shipment.customerId,
          title: isPickup ? "Shipment picked up" : "Shipment delivered",
          message: payload.note ?? `Your shipment is now ${nextStatus}`,
        },
      });

      if (
        !isPickup &&
        before.shipment.purpose === ShipmentPurpose.RETURN &&
        before.shipment.returnOfShipmentId
      ) {
        await tx.shipment.update({
          where: { id: before.shipment.returnOfShipmentId },
          data: { status: ShipmentStatus.RETURNED_TO_SENDER },
        });
        await tx.trackingEvent.create({
          data: {
            shipmentId: before.shipment.returnOfShipmentId,
            status: ShipmentStatus.RETURNED_TO_SENDER,
            note: "Paid return shipment delivered to the sender",
            createdById: actor.userId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: `${before.taskType}_TASK_COMPLETED`,
          entityType: "CourierTask",
          entityId: before.id,
          before: toJson(before),
          after: toJson(task),
        },
      });
      return task;
    });
    await invalidateTrackingCache(result.shipment.trackingNumber);
    if (result.shipment.returnOfShipmentId) {
      const original = await prisma.shipment.findUnique({
        where: { id: result.shipment.returnOfShipmentId },
        select: { trackingNumber: true },
      });
      if (original) await invalidateTrackingCache(original.trackingNumber);
    }
    return result;
  },

  failTask: async (
    id: string,
    payload: {
      reason: string;
      location?: string;
      note?: string;
      contactAttempted: true;
    },
    actor: AuthUser,
  ) => {
    const result = await runSerializableTransaction(async (tx) => {
      const before = await getOwnedTask(tx, id, actor, CourierTaskStatus.IN_PROGRESS);
      if (
        before.taskType !== CourierTaskType.DELIVERY ||
        before.shipment.status !== ShipmentStatus.OUT_FOR_DELIVERY
      ) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Only an active delivery task can fail");
      }

      const failedDeliveryCount = before.shipment.failedDeliveryCount + 1;
      const nextStatus =
        failedDeliveryCount >= 3
          ? ShipmentStatus.HELD_FOR_COLLECTION
          : ShipmentStatus.DELIVERY_FAILED;
      const task = await tx.courierTask.update({
        where: { id },
        data: {
          status: CourierTaskStatus.FAILED,
          completedAt: new Date(),
          failureReason: payload.reason,
          contactAttempted: payload.contactAttempted,
          note: payload.note,
        },
        include: taskInclude,
      });
      await tx.shipment.update({
        where: { id: before.shipmentId },
        data: {
          status: nextStatus,
          failedDeliveryCount,
          lastFailureReason: payload.reason,
          heldAt: nextStatus === ShipmentStatus.HELD_FOR_COLLECTION ? new Date() : undefined,
          currentHubId: before.hubId,
        },
      });
      await releaseCapacity(tx, before.courierProfileId);
      await tx.trackingEvent.create({
        data: {
          shipmentId: before.shipmentId,
          status: nextStatus,
          location: payload.location ?? before.hub.name,
          note:
            payload.note ??
            (nextStatus === ShipmentStatus.HELD_FOR_COLLECTION
              ? `Third delivery attempt failed: ${payload.reason}. Held for collection.`
              : `Delivery attempt ${failedDeliveryCount} failed: ${payload.reason}`),
          createdById: actor.userId,
        },
      });
      await tx.notification.create({
        data: {
          userId: before.shipment.customerId,
          title:
            nextStatus === ShipmentStatus.HELD_FOR_COLLECTION
              ? "Shipment held for collection"
              : "Delivery attempt failed",
          message:
            nextStatus === ShipmentStatus.HELD_FOR_COLLECTION
              ? "Three delivery attempts failed. The shipment is held at the destination hub."
              : `Delivery attempt ${failedDeliveryCount} failed: ${payload.reason}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "DELIVERY_TASK_FAILED",
          entityType: "CourierTask",
          entityId: before.id,
          before: toJson(before),
          after: toJson(task),
        },
      });
      return task;
    });
    await invalidateTrackingCache(result.shipment.trackingNumber);
    return result;
  },
};
