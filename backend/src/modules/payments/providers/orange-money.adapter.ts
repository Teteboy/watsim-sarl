import crypto from 'crypto';
import { env } from '../../../config/env';
import { InitiateParams, InitiateResult, PaymentAdapter, VerifyResult } from './types';

export const orangeMoneyAdapter: PaymentAdapter = {
  name: 'ORANGE_MONEY',

  async initiatePayment(params: InitiateParams): Promise<InitiateResult> {
    const providerRef = `OM_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return { providerRef, redirectUrl: `${env.ORANGE_MONEY_BASE_URL}/pay/${providerRef}` };
  },

  async verifyPayment(_providerRef: string): Promise<VerifyResult> {
    return { status: 'PENDING' };
  },

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!env.ORANGE_MONEY_WEBHOOK_SECRET) return false;
    const expected = crypto.createHmac('sha256', env.ORANGE_MONEY_WEBHOOK_SECRET).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  },
};
