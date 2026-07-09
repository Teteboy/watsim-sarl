import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sendSms } from './notification.service';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

const redis = getRedis();

function otpKey(phone: string) {
  return `otp:${phone}`;
}

export async function generateAndSendOtp(phone: string): Promise<void> {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in Redis (uses project's getRedis which may be a mock in dev)
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);

  // Send via Twilio (falls back to log if not configured)
  const body = `[WATSIM] Your verification code is: ${code}. Valid for 10 minutes.`;
  await sendSms(phone, body);

  // Always log the code for development (when Twilio not configured)
  logger.info({ phone, code }, 'OTP generated (check logs if Twilio not configured)');
  console.log(`\n📱 OTP for ${phone}: ${code}\n`);
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const stored = await redis.get(otpKey(phone));
  if (!stored) return false;

  const isValid = stored === code;
  if (isValid) {
    // Delete after successful verification (one-time use)
    await redis.del(otpKey(phone));
  }
  return isValid;
}

export async function clearOtp(phone: string): Promise<void> {
  await redis.del(otpKey(phone));
}
