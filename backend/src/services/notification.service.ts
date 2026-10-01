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

