import { z } from "zod";
import {
  CourierTaskType,
  ShipmentDirection,
  ShipmentStatus,
  ShipmentType,
} from "../../generated/prisma/enums.js";

const contactSnapshotSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(6).max(25),
  email: z.email().optional(),
  address: z.string().min(5).max(250),
  city: z.string().min(2).max(80),
  countryId: z.string().min(1),
  postalCode: z.string().max(20).optional(),
});

const shipmentInputBaseSchema = z.object({
  direction: z.enum([ShipmentDirection.EXPORT, ShipmentDirection.IMPORT]),
  shipmentType: z.enum([ShipmentType.DOCUMENT, ShipmentType.PARCEL]),
  originCountryId: z.string().min(1),
  destinationCountryId: z.string().min(1),
  originHubId: z.string().min(1),
  destinationHubId: z.string().min(1),
  weightKg: z.coerce.number().positive().max(500),
  lengthCm: z.coerce.number().positive().optional(),
  widthCm: z.coerce.number().positive().optional(),
  heightCm: z.coerce.number().positive().optional(),
  pickupScheduledAt: z.coerce.date().optional(),
  sender: contactSnapshotSchema,
  recipient: contactSnapshotSchema,
});

const shipmentInputSchema = shipmentInputBaseSchema.superRefine((value, context) => {
  if (value.originCountryId === value.destinationCountryId) {
    context.addIssue({
      code: "custom",
      message: "Origin and destination countries must be different",
      path: ["destinationCountryId"],
    });
  }

  if (value.sender.countryId !== value.originCountryId) {
    context.addIssue({
      code: "custom",
      message: "Sender country must match the origin country",
      path: ["sender", "countryId"],
    });
  }

  if (value.recipient.countryId !== value.destinationCountryId) {
    context.addIssue({
      code: "custom",
      message: "Recipient country must match the destination country",
      path: ["recipient", "countryId"],
    });
  }
});

export const quoteShipmentValidation = z.object({
  body: shipmentInputBaseSchema
    .pick({
      direction: true,
      shipmentType: true,
      originCountryId: true,
      destinationCountryId: true,
      weightKg: true,
      lengthCm: true,
      widthCm: true,
      heightCm: true,
    })
    .refine((value) => value.originCountryId !== value.destinationCountryId, {
      message: "Origin and destination countries must be different",
      path: ["destinationCountryId"],
    }),
});

export const createShipmentValidation = z.object({ body: shipmentInputSchema });

export const updateShipmentValidation = z.object({
  body: z.object({
    pickupScheduledAt: z.coerce.date().optional(),
    originHubId: z.string().min(1).optional(),
    destinationHubId: z.string().min(1).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const shipmentIdParamValidation = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const assignCourierValidation = z.object({
  body: z.object({
    courierId: z.string().min(1),
    taskType: z.enum([CourierTaskType.PICKUP, CourierTaskType.DELIVERY]),
    note: z.string().max(500).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const autoAssignValidation = z.object({
  body: z.object({
    taskType: z.enum([CourierTaskType.PICKUP, CourierTaskType.DELIVERY]),
    shipmentIds: z.array(z.string().min(1)).max(50).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    note: z.string().max(500).optional(),
  }),
});

export const updateShipmentStatusValidation = z.object({
  body: z.object({
    status: z.enum([
      ShipmentStatus.AT_ORIGIN_HUB,
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.AT_DESTINATION_HUB,
    ]),
    location: z.string().max(120).optional(),
    note: z.string().max(500).optional(),
    currentHubId: z.string().min(1).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const checkpointValidation = z.object({
  body: z.object({
    location: z.string().min(2).max(120),
    note: z.string().min(2).max(500),
    currentHubId: z.string().min(1).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const collectShipmentValidation = z.object({
  body: z.object({
    note: z.string().max(500).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const returnOrderValidation = z.object({
  body: z.object({
    note: z.string().max(500).optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});
