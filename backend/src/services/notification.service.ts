import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { sendOrangeSms } from './orange-sms.service';

export async function sendSms(to: string, body: string): Promise<void> {
  if (!env.ORANGE_SMS_AUTH_HEADER) {
    logger.info({ to, body }, 'SMS (mock, Orange SMS not configured)');
    return;
  }
  try {
    await sendOrangeSms(to, body);
  } catch (e) {
    logger.error({ err: e }, 'SMS send failed');
  }
}

export async function notifyUser(userId: string, message: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await sendSms(user.phone, `[WATSIM] ${message}`);
}

// Enhanced delivery used by admin notifications (SMS + Email)
export async function deliverNotificationToUser(userId: string, title: string, body: string, type: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const message = `${title} — ${body}`;

  // SMS
  await sendSms(user.phone, `[WATSIM] ${message}`);

  // Email (mock for now — can be replaced with real transporter)
  if (user.email) {
    // In production you would use nodemailer here
    logger.info(
      { to: user.email, subject: `[WATSIM] ${title}`, body: message, type },
      'Email notification (mock)'
    );
  }
}

// ─── Security Alerts ─────────────────────────────────────────────────────────

export async function sendLoginAlert(userId: string, ipAddress?: string, deviceInfo?: string): Promise<void> {
  const { getSecuritySettings } = await import('./security.service');
  const settings = await getSecuritySettings(userId);

  if (!settings.loginAlertsEnabled) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' });
  const location = ipAddress ? ` from IP ${ipAddress}` : '';
  const device = deviceInfo ? ` on ${deviceInfo}` : '';

  const message = `ALERT: New login to your WATSIM account${location}${device} at ${timestamp}. If this wasn't you, please secure your account immediately.`;

  await sendSms(user.phone, `[WATSIM] ${message}`);
  logger.info({ userId, ipAddress }, 'Login alert sent');

  // Also create in-app notification
  await prisma.userNotification.create({
    data: {
      userId,
      type: 'SECURITY_ALERT',
      title: 'New Login Detected',
      body: `New login${location}${device} at ${timestamp}`,
    },
  });
}

export async function sendTransactionAlert(
  userId: string,
  transactionType: string,
  amount: number,
  recipient?: string
): Promise<void> {
  const { getSecuritySettings } = await import('./security.service');
  const settings = await getSecuritySettings(userId);

  if (!settings.transactionAlertsEnabled) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const amountFormatted = `${amount.toLocaleString()} FCFA`;
  const recipientInfo = recipient ? ` to ${recipient}` : '';

  const message = `TRANSACTION: ${transactionType}${recipientInfo} of ${amountFormatted} from your WATSIM account. If you didn't authorize this, contact support immediately.`;

  await sendSms(user.phone, `[WATSIM] ${message}`);
  logger.info({ userId, transactionType, amount }, 'Transaction alert sent');

  // Also create in-app notification
  await prisma.userNotification.create({
    data: {
      userId,
      type: 'TRANSACTION_ALERT',
      title: `${transactionType} - ${amountFormatted}`,
      body: `Transaction${recipientInfo} of ${amountFormatted}`,
    },
  });
}

// ─── 2FA OTP ───────────────────────────────────────────────────────────────

const pending2FALogins = new Map<string, { userId: string; tempToken: string; expiresAt: Date }>();

export async function initiate2FALogin(userId: string): Promise<string> {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store pending 2FA with 5 minute expiry
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  pending2FALogins.set(otp, { userId, tempToken: generateTempToken(userId), expiresAt });

  // Send OTP to user
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    await sendSms(user.phone, `[WATSIM] Your verification code is: ${otp}. Valid for 5 minutes.`);
  }

  // Always log the code so it can be seen in server logs even if SMS fails
  logger.warn({ userId, phone: user?.phone, otp }, `[WATSIM_OTP] 2FA OTP for ${user?.phone ?? userId}: ${otp}`);
  console.warn(`\n🔓 [WATSIM_OTP] 2FA OTP for ${user?.phone ?? userId}: ${otp}\n`);

  logger.info({ userId }, '2FA OTP sent');

  // Clean up expired entries periodically
  cleanupExpired2FA();

  return otp;
}

export async function verify2FALogin(otp: string): Promise<{ valid: boolean; userId?: string; tempToken?: string }> {
  const entry = pending2FALogins.get(otp);

  if (!entry) return { valid: false };

  if (new Date() > entry.expiresAt) {
    pending2FALogins.delete(otp);
    return { valid: false };
  }

  pending2FALogins.delete(otp);
  return { valid: true, userId: entry.userId, tempToken: entry.tempToken };
}

function generateTempToken(userId: string): string {
  return `2fa_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

function cleanupExpired2FA(): void {
  const now = new Date();
  for (const [otp, entry] of pending2FALogins.entries()) {
    if (now > entry.expiresAt) {
      pending2FALogins.delete(otp);
    }
  }
}
