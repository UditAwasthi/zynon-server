import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum([
    "development",
    "production",
    "test",
  ]),

  PORT: z.string(),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),

  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),

  RESEND_API_KEY: z.string(),
  APP_URL: z.string(),
  EMAIL_FROM: z.string(),
});

export const env = envSchema.parse(process.env);



