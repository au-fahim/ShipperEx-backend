import httpStatus from "http-status";
import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import {
  CourierAvailabilityStatus,
  CourierTaskStatus,
  CourierTaskType,
  PaymentStatus,
  Role,
  ShipmentDirection,
  ShipmentPurpose,
  ShipmentStatus,
  type ShipmentType,
  StaffType,
} from "../../generated/prisma/enums.js";
import { ApiError } from "../../shared/ApiError.js";
import { toJson } from "../../shared/json.js";
import { getPagination } from "../../shared/pagination.js";
import { runSerializableTransaction } from "../../shared/transaction.js";
import {
  allowedShipmentTransitions,
  calculateVolumetricWeight,
  generateTrackingNumber,
  normalizeChargeableWeight,
} from "./shipment.utils.js";

type AuthUser = NonNullable<Express.Request["user"]>;

type ContactSnapshot = {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  countryId: string;
  postalCode?: string;
};

type ShipmentInput = {
  direction: ShipmentDirection;
  shipmentType: ShipmentType;
  originCountryId: string;
  destinationCountryId: string;
  originHubId: string;
  destinationHubId: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  pickupScheduledAt?: Date;
  sender: ContactSnapshot;
  recipient: ContactSnapshot;
};

type AssignmentInput = {
  courierId: string;
  taskType: CourierTaskType;
  note?: string;
};

const shipmentInclude = {
  customer: { select: { id: true, name: true, email: true } },
  originCountry: true,
  destinationCountry: true,
  originHub: { include: { country: true } },
  destinationHub: { include: { country: true } },
  currentHub: { include: { country: true } },
  payment: true,
  courierTasks: {
    where: { status: { not: CourierTaskStatus.CANCELLED } },
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      taskType: true,
      status: true,
      attemptNumber: true,
      note: true,
      assignedAt: true,
      startedAt: true,
      completedAt: true,
      courierProfile: {
        select: { user: { select: { name: true } } },
      },
    },
  },
  returnShipment: { select: { id: true, trackingNumber: true, status: true } },
  returnOfShipment: { select: { id: true, trackingNumber: true, status: true } },
} as const;

const getRateQuote = async (
  payload: Pick<
    ShipmentInput,
    | "direction"
    | "shipmentType"
    | "originCountryId"
    | "destinationCountryId"
    | "weightKg"
    | "lengthCm"
    | "widthCm"
    | "heightCm"
  >,
) => {
  if (payload.originCountryId === payload.destinationCountryId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Origin and destination countries must differ");
  }

  const [originCountry, destinationCountry] = await Promise.all([
    prisma.country.findFirst({
      where: { id: payload.originCountryId, deletedAt: null, isActive: true },
    }),
    prisma.country.findFirst({
      where: { id: payload.destinationCountryId, deletedAt: null, isActive: true },
    }),
  ]);

  if (!originCountry || !destinationCountry) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Active origin and destination countries are required",
    );
  }

  const volumetricWeight = calculateVolumetricWeight(payload);
  const chargeableWeightKg = normalizeChargeableWeight(
    Math.max(payload.weightKg, volumetricWeight),
  );
  const zoneCode =
    payload.direction === ShipmentDirection.EXPORT
      ? destinationCountry.exportZoneCode
      : originCountry.importZoneCode;

  const now = new Date();
  const rate = await prisma.shipmentRate.findFirst({
    where: {
      direction: payload.direction,
      zoneCode,
      shipmentType: payload.shipmentType,
      isActive: true,
      deletedAt: null,
      minWeightKg: { lte: chargeableWeightKg },
      AND: [
        { OR: [{ maxWeightKg: null }, { maxWeightKg: { gte: chargeableWeightKg } }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
      ],
      effectiveFrom: { lte: now },
    },
    orderBy: [{ maxWeightKg: { sort: "asc", nulls: "last" } }, { minWeightKg: "desc" }],
  });

  if (!rate) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No active shipment rate found for this route");
  }

  const fixedPrice = rate.priceUsd ? Number(rate.priceUsd) : null;
  const perKgPrice = rate.perKgRateUsd ? Number(rate.perKgRateUsd) * chargeableWeightKg : null;
  const priceUsd = Number((fixedPrice ?? perKgPrice ?? 0).toFixed(2));

  return {
    direction: payload.direction,
    shipmentType: payload.shipmentType,
    originCountry,
    destinationCountry,
    zoneCode,
    actualWeightKg: payload.weightKg,
    volumetricWeightKg: Number(volumetricWeight.toFixed(2)),
    chargeableWeightKg,
    priceUsd,
    currency: "USD",
    rateSnapshot: {
      rateId: rate.id,
      direction: rate.direction,
      zoneCode: rate.zoneCode,
      shipmentType: rate.shipmentType,
      minWeightKg: rate.minWeightKg,
      maxWeightKg: rate.maxWeightKg,
      priceUsd: rate.priceUsd,
      perKgRateUsd: rate.perKgRateUsd,
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
    },
  };
};

const validateShipmentHubs = async (payload: ShipmentInput) => {
  if (payload.sender.countryId !== payload.originCountryId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Sender country must match the origin country");
  }

  if (payload.recipient.countryId !== payload.destinationCountryId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Recipient country must match the destination country",
    );
  }

  const [originHub, destinationHub] = await Promise.all([
    prisma.hub.findFirst({
      where: {
        id: payload.originHubId,
        countryId: payload.originCountryId,
        deletedAt: null,
        isActive: true,
      },
    }),
    prisma.hub.findFirst({
      where: {
        id: payload.destinationHubId,
        countryId: payload.destinationCountryId,
        deletedAt: null,
        isActive: true,
      },
    }),
  ]);

  if (!originHub || !destinationHub) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Origin and destination hubs must be active and match their countries",
    );
  }

  return { originHub, destinationHub };
};

const assertTransition = (from: ShipmentStatus, to: ShipmentStatus) => {
  if (!allowedShipmentTransitions[from].includes(to)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Shipment cannot move from ${from} to ${to}`);
  }
};

const cacheTracking = async (trackingNumber: string, payload: unknown) => {
  if (!redis) return;
  try {
    await redis.set(`tracking:${trackingNumber}`, JSON.stringify(payload), "EX", 60);
  } catch {
    // PostgreSQL remains the source of truth when optional Redis is unavailable.
  }
};

export const invalidateTrackingCache = async (trackingNumber: string) => {
  if (!redis) return;
  try {
    await redis.del(`tracking:${trackingNumber}`);
  } catch {
    // A cache failure must not block shipment operations.
  }
};

const shipmentAccessWhere = (id: string, actor: AuthUser) => {
  if (actor.role === Role.CUSTOMER) {
    return { id, deletedAt: null, customerId: actor.userId };
  }

  if (actor.role === Role.STAFF && actor.staffType === StaffType.MANAGER) {
    return {
      id,
      deletedAt: null,
      OR: [
        { originHubId: actor.hubId },
        { destinationHubId: actor.hubId },
        { currentHubId: actor.hubId },
      ],
    };
  }

  if (actor.role === Role.STAFF && actor.staffType === StaffType.COURIER) {
    return {
      id,
      deletedAt: null,
      courierTasks: { some: { courierProfileId: actor.staffProfileId } },
    };
  }

  return { id, deletedAt: null };
};

const assignCourierTask = async (shipmentId: string, payload: AssignmentInput, actor: AuthUser) => {
  const result = await runSerializableTransaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: shipmentId, deletedAt: null },
      include: { payment: true },
    });

    if (!shipment) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");

    let requiredHubId: string;
    let nextStatus: ShipmentStatus;
    let attemptNumber = 1;

    if (payload.taskType === CourierTaskType.PICKUP) {
      if (
        shipment.purpose !== ShipmentPurpose.STANDARD ||
        shipment.status !== ShipmentStatus.PAID_AWAITING_ASSIGNMENT ||
        shipment.payment?.status !== PaymentStatus.PAID
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Shipment is not eligible for pickup assignment",
        );
      }
      requiredHubId = shipment.originHubId ?? "";
      nextStatus = ShipmentStatus.PICKUP_ASSIGNED;
    } else {
      if (
        (shipment.status !== ShipmentStatus.AT_DESTINATION_HUB &&
          shipment.status !== ShipmentStatus.DELIVERY_FAILED) ||
        shipment.failedDeliveryCount >= 3
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Shipment is not eligible for delivery assignment",
        );
      }
      requiredHubId = shipment.destinationHubId ?? "";
      nextStatus = ShipmentStatus.DELIVERY_ASSIGNED;
      attemptNumber = shipment.failedDeliveryCount + 1;
    }

    if (actor.role !== Role.ADMIN && actor.hubId !== requiredHubId) {
      throw new ApiError(httpStatus.FORBIDDEN, "Manager can assign tasks only for their own hub");
    }

    const courier = await tx.staffProfile.findFirst({
      where: {
        id: payload.courierId,
        staffType: StaffType.COURIER,
        hubId: requiredHubId,
        availabilityStatus: CourierAvailabilityStatus.AVAILABLE,
        activeTaskCount: { lt: 5 },
        deletedAt: null,
        user: { deletedAt: null, status: "ACTIVE" },
      },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!courier) {
      throw new ApiError(httpStatus.CONFLICT, "Courier is unavailable or has five active tasks");
    }

    const capacityUpdate = await tx.staffProfile.updateMany({
      where: {
        id: courier.id,
        availabilityStatus: CourierAvailabilityStatus.AVAILABLE,
        activeTaskCount: { lt: 5 },
      },
      data: { activeTaskCount: { increment: 1 } },
    });

    if (capacityUpdate.count !== 1) {
      throw new ApiError(httpStatus.CONFLICT, "Courier capacity changed; choose another courier");
    }

    const capacity = await tx.staffProfile.findUniqueOrThrow({ where: { id: courier.id } });
    if (capacity.activeTaskCount === 5) {
      await tx.staffProfile.update({
        where: { id: courier.id },
        data: { availabilityStatus: CourierAvailabilityStatus.AT_CAPACITY },
      });
    }

    const task = await tx.courierTask.create({
      data: {
        shipmentId,
        courierProfileId: courier.id,
        assignedById: actor.userId,
        hubId: requiredHubId,
        taskType: payload.taskType,
        attemptNumber,
        note: payload.note,
      },
    });

    const updatedShipment = await tx.shipment.update({
      where: { id: shipmentId },
      data: { status: nextStatus },
      include: shipmentInclude,
    });

    await tx.trackingEvent.create({
      data: {
        shipmentId,
        status: nextStatus,
        location: requiredHubId,
        note: payload.note ?? `${payload.taskType} courier ${courier.user.name} assigned`,
        createdById: actor.userId,
      },
    });

    await tx.notification.createMany({
      data: [
        {
          userId: courier.user.id,
          title: "New courier task",
          message: `You received a ${payload.taskType.toLowerCase()} task for ${shipment.trackingNumber}`,
        },
        {
          userId: shipment.customerId,
          title: `${payload.taskType === CourierTaskType.PICKUP ? "Pickup" : "Delivery"} assigned`,
          message: `${courier.user.name} was assigned to your shipment`,
        },
      ],
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        action: `${payload.taskType}_COURIER_ASSIGNED`,
        entityType: "CourierTask",
        entityId: task.id,
        before: toJson(shipment),
        after: toJson({ task, shipment: updatedShipment }),
      },
    });

    return updatedShipment;
  });

  await invalidateTrackingCache(result.trackingNumber);
  return result;
};

export const shipmentService = {
  quoteShipment: getRateQuote,

  createShipment: async (payload: ShipmentInput, customerId: string) => {
    const [quote] = await Promise.all([getRateQuote(payload), validateShipmentHubs(payload)]);

    return runSerializableTransaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          trackingNumber: generateTrackingNumber(),
          customerId,
          direction: payload.direction,
          shipmentType: payload.shipmentType,
          originCountryId: payload.originCountryId,
          destinationCountryId: payload.destinationCountryId,
          originHubId: payload.originHubId,
          destinationHubId: payload.destinationHubId,
          currentHubId: payload.originHubId,
          weightKg: payload.weightKg,
          lengthCm: payload.lengthCm,
          widthCm: payload.widthCm,
          heightCm: payload.heightCm,
          chargeableWeightKg: quote.chargeableWeightKg,
          priceUsd: quote.priceUsd,
          senderSnapshot: toJson({
            ...payload.sender,
            countryId: quote.originCountry.id,
            countryName: quote.originCountry.name,
            countryCode: quote.originCountry.iso2Code,
          }),
          recipientSnapshot: toJson({
            ...payload.recipient,
            countryId: quote.destinationCountry.id,
            countryName: quote.destinationCountry.name,
            countryCode: quote.destinationCountry.iso2Code,
          }),
          rateSnapshot: toJson(quote.rateSnapshot),
          pickupScheduledAt: payload.pickupScheduledAt,
        },
      });

      await tx.payment.create({
        data: {
          shipmentId: shipment.id,
          customerId,
          amountUsd: quote.priceUsd,
          status: PaymentStatus.PENDING,
        },
      });

      await tx.trackingEvent.create({
        data: {
          shipmentId: shipment.id,
          status: ShipmentStatus.PENDING_PAYMENT,
          note: "Shipment created and waiting for payment",
          createdById: customerId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: customerId,
          action: "SHIPMENT_CREATED",
          entityType: "Shipment",
          entityId: shipment.id,
          after: toJson(shipment),
        },
      });

      return tx.shipment.findUnique({ where: { id: shipment.id }, include: shipmentInclude });
    });
  },

  getShipments: async (query: unknown, actor: AuthUser) => {
    const pagination = getPagination(query);
    const queryRecord = query as Record<string, string | undefined>;
    const accessFilter =
      actor.role === Role.CUSTOMER
        ? { customerId: actor.userId }
        : actor.role === Role.STAFF
          ? {
              OR: [
                { originHubId: actor.hubId },
                { destinationHubId: actor.hubId },
                { currentHubId: actor.hubId },
              ],
            }
          : {};
    const where = {
      deletedAt: null,
      ...accessFilter,
      customerId:
        actor.role === Role.CUSTOMER ? actor.userId : (queryRecord.customerId ?? undefined),
      status: queryRecord.status as ShipmentStatus | undefined,
      direction: queryRecord.direction as ShipmentDirection | undefined,
      shipmentType: queryRecord.shipmentType as ShipmentType | undefined,
      AND: pagination.search
        ? [{ trackingNumber: { contains: pagination.search, mode: "insensitive" as const } }]
        : undefined,
    };

    const [data, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        include: shipmentInclude,
      }),
      prisma.shipment.count({ where }),
    ]);

    return { meta: { page: pagination.page, limit: pagination.limit, total }, data };
  },

  getShipmentById: async (id: string, actor: AuthUser) => {
    const shipment = await prisma.shipment.findFirst({
      where: shipmentAccessWhere(id, actor),
      include: shipmentInclude,
    });
    if (!shipment) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
    return shipment;
  },

  updateShipment: async (
    id: string,
    payload: { pickupScheduledAt?: Date; originHubId?: string; destinationHubId?: string },
    actor: AuthUser,
  ) =>
    runSerializableTransaction(async (tx) => {
      const before = await tx.shipment.findFirst({
        where: { id, customerId: actor.userId, deletedAt: null },
      });
      if (!before) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
      if (before.status !== ShipmentStatus.PENDING_PAYMENT) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Only unpaid shipments can be updated");
      }

      if (payload.originHubId) {
        const hub = await tx.hub.findFirst({
          where: {
            id: payload.originHubId,
            countryId: before.originCountryId,
            isActive: true,
            deletedAt: null,
          },
        });
        if (!hub) throw new ApiError(httpStatus.BAD_REQUEST, "Origin hub does not match country");
      }
      if (payload.destinationHubId) {
        const hub = await tx.hub.findFirst({
          where: {
            id: payload.destinationHubId,
            countryId: before.destinationCountryId,
            isActive: true,
            deletedAt: null,
          },
        });
        if (!hub) {
          throw new ApiError(httpStatus.BAD_REQUEST, "Destination hub does not match country");
        }
      }

      const after = await tx.shipment.update({
        where: { id },
        data: payload,
        include: shipmentInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "SHIPMENT_UPDATED",
          entityType: "Shipment",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });
      return after;
    }),

  deleteShipment: async (id: string, actor: AuthUser) =>
    runSerializableTransaction(async (tx) => {
      const before = await tx.shipment.findFirst({
        where: {
          id,
          deletedAt: null,
          customerId: actor.role === Role.CUSTOMER ? actor.userId : undefined,
        },
      });
      if (!before) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
      if (
        before.status !== ShipmentStatus.PENDING_PAYMENT &&
        before.status !== ShipmentStatus.CANCELLED
      ) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Only unpaid or cancelled shipments can be deleted",
        );
      }
      const after = await tx.shipment.update({
        where: { id },
        data: { deletedAt: new Date(), cancelledAt: new Date(), status: ShipmentStatus.CANCELLED },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "SHIPMENT_DELETED",
          entityType: "Shipment",
          entityId: id,
          before: toJson(before),
          after: toJson(after),
        },
      });
      return after;
    }),

  assignCourier: assignCourierTask,

  autoAssign: async (
    payload: {
      taskType: CourierTaskType;
      shipmentIds?: string[];
      limit: number;
      note?: string;
    },
    actor: AuthUser,
  ) => {
    if (!actor.hubId) throw new ApiError(httpStatus.FORBIDDEN, "Manager hub is required");

    const statusFilter =
      payload.taskType === CourierTaskType.PICKUP
        ? { status: ShipmentStatus.PAID_AWAITING_ASSIGNMENT, purpose: ShipmentPurpose.STANDARD }
        : { status: { in: [ShipmentStatus.AT_DESTINATION_HUB, ShipmentStatus.DELIVERY_FAILED] } };
    const hubFilter =
      payload.taskType === CourierTaskType.PICKUP
        ? { originHubId: actor.hubId }
        : { destinationHubId: actor.hubId, failedDeliveryCount: { lt: 3 } };

    const shipments = await prisma.shipment.findMany({
      where: {
        deletedAt: null,
        id: payload.shipmentIds ? { in: payload.shipmentIds } : undefined,
        ...statusFilter,
        ...hubFilter,
      },
      orderBy: [{ pickupScheduledAt: "asc" }, { createdAt: "asc" }],
      take: payload.limit,
      select: { id: true, trackingNumber: true },
    });

    const assigned: Array<{ shipmentId: string; trackingNumber: string; courierId: string }> = [];
    const skipped: Array<{ shipmentId: string; trackingNumber: string; reason: string }> = [];

    for (const shipment of shipments) {
      const courier = await prisma.staffProfile.findFirst({
        where: {
          hubId: actor.hubId,
          staffType: StaffType.COURIER,
          availabilityStatus: CourierAvailabilityStatus.AVAILABLE,
          activeTaskCount: { lt: 5 },
          deletedAt: null,
          user: { status: "ACTIVE", deletedAt: null },
        },
        orderBy: [{ activeTaskCount: "asc" }, { updatedAt: "asc" }],
        select: { id: true },
      });

      if (!courier) {
        skipped.push({
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          reason: "No courier capacity available at this hub",
        });
        continue;
      }

      try {
        await assignCourierTask(
          shipment.id,
          { courierId: courier.id, taskType: payload.taskType, note: payload.note },
          actor,
        );
        assigned.push({
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          courierId: courier.id,
        });
      } catch (error) {
        skipped.push({
          shipmentId: shipment.id,
          trackingNumber: shipment.trackingNumber,
          reason: error instanceof Error ? error.message : "Assignment failed",
        });
      }
    }

    return { assigned, skipped };
  },

  updateStatus: async (
    shipmentId: string,
    payload: { status: ShipmentStatus; location?: string; note?: string; currentHubId?: string },
    actor: AuthUser,
  ) => {
    const result = await runSerializableTransaction(async (tx) => {
      const before = await tx.shipment.findFirst({ where: { id: shipmentId, deletedAt: null } });
      if (!before) throw new ApiError(httpStatus.NOT_FOUND, "Shipment not found");
      assertTransition(before.status, payload.status);

      const requiredHubId =
        payload.status === ShipmentStatus.AT_DESTINATION_HUB
          ? before.destinationHubId
          : (before.currentHubId ?? before.originHubId);
      if (actor.role !== Role.ADMIN && actor.hubId !== requiredHubId) {
        throw new ApiError(httpStatus.FORBIDDEN, "Manager cannot update this hub's shipment");
      }

      if (payload.currentHubId) {
        const hub = await tx.hub.findFirst({
          where: { id: payload.currentHubId, isActive: true, deletedAt: null },
          select: { id: true },
        });
        if (!hub) throw new ApiError(httpStatus.BAD_REQUEST, "Active current hub not found");
      }

      const currentHubId =
        payload.status === ShipmentStatus.AT_ORIGIN_HUB
          ? before.originHubId
          : payload.status === ShipmentStatus.AT_DESTINATION_HUB
            ? before.destinationHubId
            : (payload.currentHubId ?? before.currentHubId);

      const after = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: payload.status, currentHubId },
        include: shipmentInclude,
      });
      await tx.trackingEvent.create({
        data: {
          shipmentId,
          status: payload.status,
          location: payload.location,
          note: payload.note,
          createdById: actor.userId,
        },
      });
      await tx.notification.create({
        data: {
          userId: before.customerId,
          title: "Shipment status updated",
          message: payload.note ?? `Shipment moved to ${payload.status}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.userId,
          action: "SHIPMENT_STATUS_UPDATED",
          entityType: "Shipment",
          entityId: shipmentId,
          before: toJson(before),
          after: toJson(after),
        },
      });
      return after;
    });
    await invalidateTrackingCache(result.trackingNumber);
    return result;
  },

  addCheckpoint: async (
    shipmentId: string,
    payload: { location: string; note: string; currentHubId?: string },
    actor: AuthUser,
  ) => {
    const result = await runSerializableTransaction(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, deletedAt: null, status: ShipmentStatus.IN_TRANSIT },
      });
      if (!shipment) throw new ApiError(httpStatus.BAD_REQUEST, "In-transit shipment not found");
      if (
        actor.role !== Role.ADMIN &&
        ![shipment.originHubId, shipment.destinationHubId, shipment.currentHubId].includes(
          actor.hubId ?? null,
        )
      ) {
        throw new ApiError(httpStatus.FORBIDDEN, "Manager cannot checkpoint this shipment");
      }

      if (payload.currentHubId) {
        const hub = await tx.hub.findFirst({
          where: { id: payload.currentHubId, isActive: true, deletedAt: null },
        });
        if (!hub) throw new ApiError(httpStatus.BAD_REQUEST, "Active checkpoint hub not found");
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { currentHubId: payload.currentHubId },
      });
      const event = await tx.trackingEvent.create({
        data: {
          shipmentId,
          status: ShipmentStatus.IN_TRANSIT,
          location: payload.location,
          note: payload.note,
          createdById: actor.userId,
        },
      });
      return { updated, event };
    });
    await invalidateTrackingCache(result.updated.trackingNumber);
    return result.event;
  },

  collectFromHub: async (shipmentId: string, note: string | undefined, actor: AuthUser) => {
    const result = await runSerializableTransaction(async (tx) => {
      const before = await tx.shipment.findFirst({
        where: { id: shipmentId, deletedAt: null, status: ShipmentStatus.HELD_FOR_COLLECTION },
        include: { returnShipment: true },
      });
      if (!before) throw new ApiError(httpStatus.BAD_REQUEST, "Held shipment not found");
      if (
        before.returnShipment?.status !== undefined &&
        before.returnShipment.status !== ShipmentStatus.CANCELLED
      ) {
        throw new ApiError(httpStatus.CONFLICT, "A return shipment already exists");
      }
      if (actor.role !== Role.ADMIN && actor.hubId !== before.destinationHubId) {
        throw new ApiError(
          httpStatus.FORBIDDEN,
          "Only the destination hub can release this shipment",
        );
      }

      const after = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.COLLECTED_FROM_HUB,
          collectedAt: new Date(),
          currentHubId: before.destinationHubId,
        },
        include: shipmentInclude,
      });
      await tx.trackingEvent.create({
        data: {
          shipmentId,
          status: ShipmentStatus.COLLECTED_FROM_HUB,
          note: note ?? "Shipment collected from destination hub",
          createdById: actor.userId,
        },
      });
      await tx.notification.create({
        data: {
          userId: before.customerId,
          title: "Shipment collected",
          message: "The receiver collected the shipment from the destination hub",
        },
      });
      return after;
    });
    await invalidateTrackingCache(result.trackingNumber);
    return result;
  },

  createReturnOrder: async (shipmentId: string, note: string | undefined, customerId: string) => {
    const original = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        customerId,
        deletedAt: null,
        status: ShipmentStatus.HELD_FOR_COLLECTION,
      },
      include: { returnShipment: true },
    });
    if (!original) throw new ApiError(httpStatus.BAD_REQUEST, "Held shipment not found");
    if (original.returnShipment) {
      throw new ApiError(httpStatus.CONFLICT, "Return shipment already exists");
    }
    if (!original.originHubId || !original.destinationHubId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Original shipment hubs are incomplete");
    }

    const returnDirection =
      original.direction === ShipmentDirection.EXPORT
        ? ShipmentDirection.IMPORT
        : ShipmentDirection.EXPORT;
    const quote = await getRateQuote({
      direction: returnDirection,
      shipmentType: original.shipmentType,
      originCountryId: original.destinationCountryId,
      destinationCountryId: original.originCountryId,
      weightKg: Number(original.weightKg),
      lengthCm: original.lengthCm ? Number(original.lengthCm) : undefined,
      widthCm: original.widthCm ? Number(original.widthCm) : undefined,
      heightCm: original.heightCm ? Number(original.heightCm) : undefined,
    });

    return runSerializableTransaction(async (tx) => {
      const available = await tx.shipment.findFirst({
        where: {
          id: shipmentId,
          customerId,
          status: ShipmentStatus.HELD_FOR_COLLECTION,
          returnShipment: null,
        },
      });
      if (!available) throw new ApiError(httpStatus.CONFLICT, "Shipment is no longer returnable");

      const returned = await tx.shipment.create({
        data: {
          trackingNumber: generateTrackingNumber(),
          customerId,
          purpose: ShipmentPurpose.RETURN,
          returnOfShipmentId: original.id,
          direction: returnDirection,
          shipmentType: original.shipmentType,
          originCountryId: original.destinationCountryId,
          destinationCountryId: original.originCountryId,
          originHubId: original.destinationHubId,
          destinationHubId: original.originHubId,
          currentHubId: original.destinationHubId,
          weightKg: original.weightKg,
          lengthCm: original.lengthCm,
          widthCm: original.widthCm,
          heightCm: original.heightCm,
          chargeableWeightKg: quote.chargeableWeightKg,
          priceUsd: quote.priceUsd,
          senderSnapshot: toJson(original.recipientSnapshot) as never,
          recipientSnapshot: toJson(original.senderSnapshot) as never,
          rateSnapshot: toJson(quote.rateSnapshot),
        },
      });
      await tx.payment.create({
        data: {
          shipmentId: returned.id,
          customerId,
          amountUsd: quote.priceUsd,
          status: PaymentStatus.PENDING,
        },
      });
      await tx.trackingEvent.create({
        data: {
          shipmentId: returned.id,
          status: ShipmentStatus.PENDING_PAYMENT,
          note: note ?? "Return shipment created and waiting for payment",
          createdById: customerId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: customerId,
          action: "RETURN_SHIPMENT_CREATED",
          entityType: "Shipment",
          entityId: returned.id,
          after: toJson(returned),
        },
      });
      return tx.shipment.findUnique({ where: { id: returned.id }, include: shipmentInclude });
    });
  },

  getTimeline: async (shipmentId: string, actor: AuthUser) => {
    await shipmentService.getShipmentById(shipmentId, actor);
    return prisma.trackingEvent.findMany({
      where: { shipmentId },
      orderBy: { createdAt: "asc" },
      include: { createdBy: { select: { id: true, name: true, role: true } } },
    });
  },

  trackByTrackingNumber: async (trackingNumber: string) => {
    if (redis) {
      try {
        const cached = await redis.get(`tracking:${trackingNumber}`);
        if (cached) return JSON.parse(cached) as unknown;
      } catch {
        // Ignore cache failures and read from PostgreSQL.
      }
    }

    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber, deletedAt: null },
      select: {
        id: true,
        trackingNumber: true,
        purpose: true,
        status: true,
        direction: true,
        shipmentType: true,
        originCountry: { select: { name: true } },
        destinationCountry: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
        trackingEvents: {
          orderBy: { createdAt: "asc" },
          select: { status: true, location: true, note: true, createdAt: true },
        },
      },
    });
    if (!shipment) throw new ApiError(httpStatus.NOT_FOUND, "Tracking number not found");
    await cacheTracking(trackingNumber, shipment);
    return shipment;
  },
};
