import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PREFIX: z.string().default('/api/v1'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().optional(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  ORANGE_MONEY_BASE_URL: z.string().optional(),
  ORANGE_MONEY_MERCHANT_KEY: z.string().optional(),
  ORANGE_MONEY_WEBHOOK_SECRET: z.string().optional(),

  MTN_MOMO_BASE_URL: z.string().optional(),
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().optional(),
  MTN_MOMO_API_USER: z.string().optional(),
  MTN_MOMO_API_KEY: z.string().optional(),
  MTN_MOMO_WEBHOOK_SECRET: z.string().optional(),

  USE_CAMPAY: z.coerce.boolean().default(false),
  CAMPAY_BASE_URL: z.string().default('https://demo.campay.net'),
  CAMPAY_USERNAME: z.string().optional(),
  CAMPAY_PASSWORD: z.string().optional(),
  CAMPAY_PERMENENT_ACCESS_TOKEN: z.string().optional(),
  CAMPAY_WEBHOOK_KEY: z.string().optional(),

  WAVE_API_KEY: z.string().optional(),
  WAVE_API_URL: z.string().default('https://api.wave.com'),

  ORANGE_SMS_CLIENT_ID: z.string().optional(),
  ORANGE_SMS_CLIENT_SECRET: z.string().optional(),
  ORANGE_SMS_AUTH_HEADER: z.string().optional(),
  ORANGE_SMS_SENDER_ADDRESS: z.string().default('2370000'),

  USE_SMILE_ID: z.coerce.boolean().default(false),
  SMILE_ID_BASE_URL: z.string().default('https://testapi.smileidentity.com'),
  SMILE_ID_PARTNER_ID: z.string().optional(),
  SMILE_ID_API_KEY: z.string().optional(),
  SMILE_ID_CALLBACK_URL: z.string().optional(),

  TIMEZONE: z.string().default('Africa/Douala'),
  LOG_LEVEL: z.string().default('info'),
  USE_MOCK_PAYMENTS: z.coerce.boolean().default(false),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

let env = parsed.data;

// Derive Orange SMS basic-auth header from client id/secret if not provided directly
if (!env.ORANGE_SMS_AUTH_HEADER && env.ORANGE_SMS_CLIENT_ID && env.ORANGE_SMS_CLIENT_SECRET) {
  env = {
    ...env,
    ORANGE_SMS_AUTH_HEADER: Buffer.from(
      `${env.ORANGE_SMS_CLIENT_ID}:${env.ORANGE_SMS_CLIENT_SECRET}`
    ).toString('base64'),
  };
}

export { env };
export type Env = typeof env;
