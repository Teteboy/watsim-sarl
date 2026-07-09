import crypto from 'crypto';
import { env } from '../../../config/env';
import { getRedis } from '../../../config/redis';
import { logger } from '../../../config/logger';
import type { InitiateParams, InitiateResult, PaymentAdapter, Provider, VerifyResult } from './types';

const TOKEN_KEY = 'campay:token';
const TOKEN_TTL_SEC = 60 * 50;

async function fetchToken(): Promise<string> {
  // Use permanent access token directly if available (preferred for demo)
  if (env.CAMPAY_PERMENENT_ACCESS_TOKEN) {
    return env.CAMPAY_PERMENENT_ACCESS_TOKEN;
  }
  if (!env.CAMPAY_USERNAME || !env.CAMPAY_PASSWORD || !env.CAMPAY_BASE_URL) {
    throw new Error('CamPay credentials missing');
  }
  const redis = getRedis();
  const cached = await redis.get(TOKEN_KEY);
  if (cached) return cached;
  const res = await fetch(`${env.CAMPAY_BASE_URL}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.CAMPAY_USERNAME, password: env.CAMPAY_PASSWORD }),
  });
  if (!res.ok) throw new Error(`CamPay token failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  await redis.set(TOKEN_KEY, data.token, 'EX', TOKEN_TTL_SEC);
  return data.token;
}

function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('237')) return digits;
  if (digits.startsWith('6') && digits.length === 9) return `237${digits}`;
  return digits;
}

function mapStatus(s: string | undefined): VerifyResult['status'] {
  if (!s) return 'PENDING';
  const v = s.toUpperCase();
  if (v === 'SUCCESSFUL' || v === 'SUCCESS' || v === 'COMPLETED') return 'COMPLETED';
  if (v === 'FAILED' || v === 'CANCELLED' || v === 'CANCELED') return 'FAILED';
  return 'PENDING';
}

function buildAdapter(name: Provider): PaymentAdapter {
  return {
    name,
    async initiatePayment(params: InitiateParams): Promise<InitiateResult> {
      const token = await fetchToken();
      const phone = normalisePhone(params.phone);
      const body = {
        amount: String(params.amount),
        currency: params.currency,
        from: phone,
        description: `WATSIM payment`,
        external_reference: params.reference.slice(0, 20),
      };
      logger.info({ campayRequest: { ...body, tokenPrefix: token.slice(0, 8) }, url: `${env.CAMPAY_BASE_URL}/api/collect/` }, 'CamPay collect request');
      const res = await fetch(`${env.CAMPAY_BASE_URL}/api/collect/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
        body: JSON.stringify(body),
      });
      const responseText = await res.text();
      logger.info({ status: res.status, body: responseText }, 'CamPay collect response');
      if (!res.ok) {
        logger.error({ status: res.status, body: responseText, request: body }, 'CamPay collect failed');
        let msg = `Payment failed (${res.status}). Please try again.`;
        try {
          const err = JSON.parse(responseText);
          if (err.error_code === 'ER201') msg = 'Sandbox limit: maximum amount is 25 XAF on demo mode.';
          else if (err.message) msg = err.message;
        } catch (_) {}
        throw new Error(msg);
      }
      const data = (await JSON.parse(responseText)) as { reference: string; ussd_code?: string; operator?: string };
      return { providerRef: data.reference, ussdCode: data.ussd_code };
    },

    async verifyPayment(providerRef: string): Promise<VerifyResult> {
      const token = await fetchToken();
      const res = await fetch(`${env.CAMPAY_BASE_URL}/api/transaction/${encodeURIComponent(providerRef)}/`, {
        headers: { Authorization: `Token ${token}` },
      });
      if (!res.ok) return { status: 'PENDING' };
      const data = (await res.json()) as { status?: string; amount?: string };
      return { status: mapStatus(data.status), amount: data.amount ? Number(data.amount) : undefined };
    },

    verifyWebhookSignature(payload: string, signature: string): boolean {
      if (!env.CAMPAY_WEBHOOK_KEY) return false;
      const expected = crypto.createHmac('sha256', env.CAMPAY_WEBHOOK_KEY).update(payload).digest('hex');
      try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        return false;
      }
    },
  };
}

export const campayMtnAdapter: PaymentAdapter = buildAdapter('MTN_MOMO');
export const campayOrangeAdapter: PaymentAdapter = buildAdapter('ORANGE_MONEY');
