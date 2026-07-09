import crypto from 'crypto';
import { env } from '../../../config/env';
import { InitiateParams, InitiateResult, PaymentAdapter, VerifyResult } from './types';

export const mtnMomoAdapter: PaymentAdapter = {
  name: 'MTN_MOMO',

  async initiatePayment(_params: InitiateParams): Promise<InitiateResult> {
    const providerRef = `MOMO_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return { providerRef };
  },

  async verifyPayment(_providerRef: string): Promise<VerifyResult> {
    return { status: 'PENDING' };
  },

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!env.MTN_MOMO_WEBHOOK_SECRET) return false;
    const expected = crypto.createHmac('sha256', env.MTN_MOMO_WEBHOOK_SECRET).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  },
};
