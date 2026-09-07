import { z } from "zod";
import { Role, UserStatus } from "../../generated/prisma/enums.js";

export const updateMeValidation = z.object({
  body: z.object({
    name: z.string().min(2).max(80).optional(),
    phone: z.string().min(6).max(25).optional(),
    avatarUrl: z.url().optional(),
  }),
});

export const updateUserStatusValidation = z.object({
  body: z.object({
    status: z.enum([UserStatus.ACTIVE, UserStatus.BLOCKED]),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const updateUserRoleValidation = z.object({
  body: z.object({
    role: z.enum([Role.CUSTOMER, Role.STAFF, Role.ADMIN]),
  }),
  params: z.object({
    id: z.string().min(1),
  }),
});

export const userIdParamValidation = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});
