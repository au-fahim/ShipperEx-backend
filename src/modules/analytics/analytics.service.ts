import { prisma } from "../../config/prisma.js";
import {
  CourierAvailabilityStatus,
  PaymentStatus,
  Role,
  ShipmentStatus,
  StaffType,
} from "../../generated/prisma/enums.js";

type AuthUser = NonNullable<Express.Request["user"]>;

export const analyticsService = {
  getDashboardStats: async () => {
    const [
      totalUsers,
      totalCustomers,
      totalShipments,
      pendingShipments,
      deliveredShipments,
      failedShipments,
      totalCouriers,
      availableCouriers,
      paidPayments,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: "CUSTOMER" } }),
      prisma.shipment.count({ where: { deletedAt: null } }),
      prisma.shipment.count({ where: { deletedAt: null, status: ShipmentStatus.PENDING_PAYMENT } }),
      prisma.shipment.count({ where: { deletedAt: null, status: ShipmentStatus.DELIVERED } }),
      prisma.shipment.count({ where: { deletedAt: null, status: ShipmentStatus.DELIVERY_FAILED } }),
      prisma.staffProfile.count({ where: { deletedAt: null, staffType: StaffType.COURIER } }),
      prisma.staffProfile.count({
        where: {
          deletedAt: null,
          staffType: StaffType.COURIER,
          availabilityStatus: CourierAvailabilityStatus.AVAILABLE,
          activeTaskCount: { lt: 5 },
        },
      }),
      prisma.payment.findMany({
        where: { status: PaymentStatus.PAID },
        select: { amountUsd: true },
      }),
    ]);

    const revenueUsd = paidPayments.reduce((sum, payment) => sum + Number(payment.amountUsd), 0);

    return {
      totalUsers,
      totalCustomers,
      totalShipments,
      pendingShipments,
      deliveredShipments,
      failedShipments,
      totalCouriers,
      availableCouriers,
      revenueUsd: Number(revenueUsd.toFixed(2)),
    };
  },

  getShipmentReport: async (actor: AuthUser) => {
    const where = {
      deletedAt: null,
      ...(actor.role === Role.STAFF
        ? {
            OR: [
              { originHubId: actor.hubId },
              { destinationHubId: actor.hubId },
              { currentHubId: actor.hubId },
            ],
          }
        : {}),
    };
    const byStatus = await prisma.shipment.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    const byDirection = await prisma.shipment.groupBy({
      by: ["direction"],
      where,
      _count: { direction: true },
    });

    const byType = await prisma.shipment.groupBy({
      by: ["shipmentType"],
      where,
      _count: { shipmentType: true },
    });

    return { byStatus, byDirection, byType };
  },
};
