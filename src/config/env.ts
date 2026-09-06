import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(12, "JWT_ACCESS_SECRET must be at least 12 characters"),
  JWT_REFRESH_SECRET: z.string().min(12, "JWT_REFRESH_SECRET must be at least 12 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  STRIPE_SUCCESS_URL: z.string().url(),
  STRIPE_CANCEL_URL: z.string().url(),
  REDIS_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  REDIS_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().default("*"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment variables", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
