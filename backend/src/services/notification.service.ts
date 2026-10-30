import { env } from '../config/env';
import { logger } from '../config/logger';
import { prisma } from '../config/db';
import { sendOrangeSms } from './orange-sms.service';
import { msg, userLocale, type MessageVars } from '../utils/messages';

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

/**
 * Send a localized SMS to a user. `messageKey` is a key from utils/messages.ts;
 * the user's locale (preferredLanguage/locale field, default French) is used.
 */
export async function notifyUser(userId: string, messageKey: string, vars: MessageVars = {}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const message = msg(messageKey, userLocale(user), vars);
  await sendSms(user.phone, `[WATSIM] ${message}`);
}

// Enhanced delivery used by admin notifications (SMS + Email).
// Admin-authored title/body are delivered verbatim — not localized.
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

/**
 * Localized variant of deliverNotificationToUser for backend-generated
 * notifications: pass message keys instead of verbatim text.
 */
export async function deliverLocalizedNotificationToUser(
  userId: string,
  titleKey: string,
  bodyKey: string,
  type: string,
  vars: MessageVars = {}
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const locale = userLocale(user);
  await deliverNotificationToUser(userId, msg(titleKey, locale, vars), msg(bodyKey, locale, vars), type);
}

// ─── Security Alerts ─────────────────────────────────────────────────────────

export async function sendLoginAlert(userId: string, ipAddress?: string, deviceInfo?: string): Promise<void> {
  const { getSecuritySettings } = await import('./security.service');
  const settings = await getSecuritySettings(userId);

  if (!settings.loginAlertsEnabled) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const locale = userLocale(user);
  const timestamp = new Date().toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', { timeZone: 'Africa/Douala' });
  const location = ipAddress ? (locale === 'en' ? ` from IP ${ipAddress}` : ` depuis l'IP ${ipAddress}`) : '';
  const device = deviceInfo ? (locale === 'en' ? ` on ${deviceInfo}` : ` sur ${deviceInfo}`) : '';

  const vars = { location, device, timestamp };
  const message = msg('security.loginAlert.sms', locale, vars);

  await sendSms(user.phone, `[WATSIM] ${message}`);
  logger.info({ userId, ipAddress }, 'Login alert sent');

  // Also create in-app notification
  await prisma.userNotification.create({
    data: {
      userId,
      type: 'SECURITY_ALERT',
      title: msg('security.loginAlert.title', locale),
      body: msg('security.loginAlert.body', locale, vars),
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

  const locale = userLocale(user);
  const amountFormatted = `${amount.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR')} FCFA`;
  const recipientInfo = recipient ? (locale === 'en' ? ` to ${recipient}` : ` vers ${recipient}`) : '';

  const vars = { type: transactionType, recipient: recipientInfo, amount: amountFormatted };
  const message = msg('transaction.alert.sms', locale, vars);

  await sendSms(user.phone, `[WATSIM] ${message}`);
  logger.info({ userId, transactionType, amount }, 'Transaction alert sent');

  // Also create in-app notification
  await prisma.userNotification.create({
    data: {
      userId,
      type: 'TRANSACTION_ALERT',
      title: msg('transaction.alert.title', locale, vars),
      body: msg('transaction.alert.body', locale, vars),
    },
  });
}
