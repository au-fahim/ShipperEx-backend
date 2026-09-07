import { z } from "zod";
import { ShipmentDirection, ShipmentType } from "../../generated/prisma/enums.js";

const rateBaseBodySchema = z.object({
  direction: z.enum([ShipmentDirection.EXPORT, ShipmentDirection.IMPORT]),
  zoneCode: z.string().min(1).max(5),
  shipmentType: z.enum([ShipmentType.DOCUMENT, ShipmentType.PARCEL]),
  minWeightKg: z.coerce.number().positive(),
  maxWeightKg: z.coerce.number().positive().optional().nullable(),
  priceUsd: z.coerce.number().positive().optional().nullable(),
  perKgRateUsd: z.coerce.number().positive().optional().nullable(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
});

const createRateBodySchema = rateBaseBodySchema
  .refine((data) => data.priceUsd || data.perKgRateUsd, {
    message: "Either priceUsd or perKgRateUsd is required",
    path: ["priceUsd"],
  })
  .refine((data) => !data.maxWeightKg || data.maxWeightKg >= data.minWeightKg, {
    message: "maxWeightKg must be greater than or equal to minWeightKg",
    path: ["maxWeightKg"],
  });

const updateRateBodySchema = rateBaseBodySchema
  .partial()
  .refine(
    (data) =>
      data.minWeightKg === undefined ||
      data.maxWeightKg === undefined ||
      data.maxWeightKg === null ||
      data.maxWeightKg >= data.minWeightKg,
    {
      message: "maxWeightKg must be greater than or equal to minWeightKg",
      path: ["maxWeightKg"],
    },
  );

export const createShipmentRateValidation = z.object({
  body: createRateBodySchema,
});

export const updateShipmentRateValidation = z.object({
  body: updateRateBodySchema,
  params: z.object({
    id: z.string().min(1),
  }),
});

export const shipmentRateIdParamValidation = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
