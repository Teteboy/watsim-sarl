import { env } from '../config/env';
import { logger } from '../config/logger';

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Obtain an OAuth2 access token from Orange API.
 * Tokens are cached until 5 minutes before expiry.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const authHeader = env.ORANGE_SMS_AUTH_HEADER;
  if (!authHeader) {
    throw new Error('ORANGE_SMS_AUTH_HEADER not configured');
  }

  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, 'Orange SMS: failed to get access token');
    throw new Error(`Orange OAuth failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Cache with 5 min buffer
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  logger.info('Orange SMS: access token obtained');
  return cachedToken.token;
}

/**
 * Send an SMS via Orange SMS API (Cameroon).
 * @param to - Recipient phone number in international format (e.g. +237688788545)
 * @param message - SMS text body
 */
export async function sendOrangeSms(to: string, message: string): Promise<void> {
  const senderAddress = env.ORANGE_SMS_SENDER_ADDRESS;
  if (!senderAddress) {
    logger.warn({ to, message }, 'Orange SMS: ORANGE_SMS_SENDER_ADDRESS not set, skipping');
    return;
  }

  const token = await getAccessToken();

  // Normalize phone number: ensure it starts with tel:+
  const telTo = to.startsWith('tel:') ? to : `tel:+${to.replace(/^\+/, '')}`;
  const telSender = senderAddress.startsWith('tel:') ? senderAddress : `tel:+${senderAddress.replace(/^\+/, '')}`;
  const encodedSender = encodeURIComponent(telSender);

  const url = `https://api.orange.com/smsmessaging/v1/outbound/${encodedSender}/requests`;

  const body = {
    outboundSMSMessageRequest: {
      address: telTo,
      senderAddress: telSender,
      outboundSMSTextMessage: {
        message,
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text, to }, 'Orange SMS: send failed');
    throw new Error(`Orange SMS send failed: ${res.status}`);
  }

  logger.info({ to }, 'Orange SMS: message sent successfully');
}

/**
 * Check SMS contract/bundle balance from Orange API.
 * Returns the raw contract data from Orange.
 */
export async function checkSmsBalance(): Promise<unknown> {
  const token = await getAccessToken();

  const res = await fetch('https://api.orange.com/sms/admin/v1/contracts', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error({ status: res.status, body: text }, 'Orange SMS: failed to check contracts');
    throw new Error(`Orange SMS contracts check failed: ${res.status}`);
  }

  return res.json();
}
