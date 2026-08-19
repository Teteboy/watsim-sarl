import { getRedis } from '../config/redis';
import { logger } from '../config/logger';
import { sendSms } from './notification.service';

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes

function otpKey(phone: string) {
  return `otp:${phone}`;
}

export async function generateAndSendOtp(phone: string): Promise<void> {
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Store in Redis (uses project's getRedis which may be a mock in dev)
  const redis = getRedis();
  await redis.set(otpKey(phone), code, 'EX', OTP_TTL_SECONDS);

  // Send via Orange SMS (falls back to log if not configured)
  const body = `[WATSIM] Your verification code is: ${code}. Valid for 10 minutes.`;
  await sendSms(phone, body);

  // Always log the code for development (when Orange SMS not configured)
  logger.info({ phone, code }, 'OTP generated (check logs if Orange SMS not configured)');
  console.log(`\n📱 OTP for ${phone}: ${code}\n`);
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const redis = getRedis();
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
  const redis = getRedis();
  await redis.del(otpKey(phone));
}
