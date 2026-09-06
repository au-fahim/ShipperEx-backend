import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const registerValidation = z.object({
  body: z.object({
    name: z.string().min(2).max(80),
    email: z.email(),
    password: passwordSchema,
    phone: z.string().min(6).max(25).optional(),
  }),
});

export const loginValidation = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(1),
  }),
});

export const refreshTokenValidation = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});

export const logoutValidation = refreshTokenValidation;

export const googleLoginValidation = z.object({
  body: z.object({
    idToken: z.string().min(1),
  }),
});
