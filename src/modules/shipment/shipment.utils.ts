import { ShipmentStatus } from "../../generated/prisma/enums.js";

export const generateTrackingNumber = () => {
  const now = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SXP-${now}-${random}`;
};

export const calculateVolumetricWeight = ({
  lengthCm,
  widthCm,
  heightCm,
}: {
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}) => {
  if (!lengthCm || !widthCm || !heightCm) {
    return 0;
  }

  return (lengthCm * widthCm * heightCm) / 5000;
};

export const normalizeChargeableWeight = (weight: number) => Math.ceil(weight * 2) / 2;

export const allowedShipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.PENDING_PAYMENT]: [ShipmentStatus.CANCELLED],
  [ShipmentStatus.PAID_AWAITING_ASSIGNMENT]: [
    ShipmentStatus.PICKUP_ASSIGNED,
    ShipmentStatus.AT_ORIGIN_HUB,
    ShipmentStatus.CANCELLED,
  ],
  [ShipmentStatus.PICKUP_ASSIGNED]: [ShipmentStatus.PICKED_UP, ShipmentStatus.CANCELLED],
  [ShipmentStatus.PICKED_UP]: [ShipmentStatus.AT_ORIGIN_HUB],
  [ShipmentStatus.AT_ORIGIN_HUB]: [ShipmentStatus.IN_TRANSIT],
  [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.AT_DESTINATION_HUB],
  [ShipmentStatus.AT_DESTINATION_HUB]: [ShipmentStatus.DELIVERY_ASSIGNED],
  [ShipmentStatus.DELIVERY_ASSIGNED]: [ShipmentStatus.OUT_FOR_DELIVERY],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [ShipmentStatus.DELIVERED, ShipmentStatus.DELIVERY_FAILED],
  [ShipmentStatus.DELIVERY_FAILED]: [
    ShipmentStatus.DELIVERY_ASSIGNED,
    ShipmentStatus.HELD_FOR_COLLECTION,
  ],
  [ShipmentStatus.HELD_FOR_COLLECTION]: [
    ShipmentStatus.COLLECTED_FROM_HUB,
    ShipmentStatus.RETURN_BOOKED,
  ],
  [ShipmentStatus.RETURN_BOOKED]: [ShipmentStatus.RETURNED_TO_SENDER],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.COLLECTED_FROM_HUB]: [],
  [ShipmentStatus.RETURNED_TO_SENDER]: [],
  [ShipmentStatus.CANCELLED]: [],
};
