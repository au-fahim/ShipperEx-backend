import { z } from "zod";

const hubBodySchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  city: z.string().min(2).max(80),
  countryId: z.string().min(1),
  address: z.string().min(5).max(250),
  isActive: z.boolean().optional(),
});

export const createHubValidation = z.object({
  body: hubBodySchema,
});

export const updateHubValidation = z.object({
  body: hubBodySchema.partial(),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const hubIdParamValidation = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
