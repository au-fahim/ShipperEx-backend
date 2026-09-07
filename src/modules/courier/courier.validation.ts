import { z } from "zod";
import { CourierAvailabilityStatus } from "../../generated/prisma/enums.js";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

const staffAccountSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  password: passwordSchema,
  phone: z.string().min(6).max(25).optional(),
  hubId: z.string().min(1),
});

export const createManagerValidation = z.object({ body: staffAccountSchema });

export const createCourierValidation = z.object({
  body: staffAccountSchema.extend({
    phone: z.string().min(6).max(25),
  }),
});

export const updateCourierValidation = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().min(6).max(25).optional(),
    hubId: z.string().min(1).optional(),
    availabilityStatus: z
      .enum([
        CourierAvailabilityStatus.AVAILABLE,
        CourierAvailabilityStatus.OFFLINE,
        CourierAvailabilityStatus.SUSPENDED,
      ])
      .optional(),
  }),
  params: z.object({ id: z.string().min(1) }),
});

export const courierIdParamValidation = z.object({
  params: z.object({ id: z.string().min(1) }),
});
