import { z } from "zod";

const countryBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  iso2Code: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  exportZoneCode: z.string().trim().min(1).max(5),
  importZoneCode: z.string().trim().min(1).max(5),
});

const countryUpdateBodySchema = z
  .object({
    exportZoneCode: z.string().trim().min(1).max(5).optional(),
    importZoneCode: z.string().trim().min(1).max(5).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one country field to update",
  });

export const createCountryValidation = z.object({
  body: countryBodySchema,
});

export const updateCountryValidation = z.object({
  body: countryUpdateBodySchema,
  params: z.object({ id: z.string().min(1) }),
});

export const countryIdParamValidation = z.object({
  params: z.object({ id: z.string().min(1) }),
});