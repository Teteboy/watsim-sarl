import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const hmac = (secret: string, payload: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('Payment adapters', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('orange money: rejects webhooks when no secret configured', async () => {
    vi.stubEnv('ORANGE_MONEY_WEBHOOK_SECRET', '');
    const { orangeMoneyAdapter } = await import('../src/modules/payments/providers/orange-money.adapter');
    expect(orangeMoneyAdapter.verifyWebhookSignature('payload', 'whatever')).toBe(false);
  });

  it('orange money: validates a correct HMAC signature', async () => {
    vi.stubEnv('ORANGE_MONEY_WEBHOOK_SECRET', 'test-secret');
    const { orangeMoneyAdapter } = await import('../src/modules/payments/providers/orange-money.adapter');
    expect(orangeMoneyAdapter.verifyWebhookSignature('payload', hmac('test-secret', 'payload'))).toBe(true);
    expect(orangeMoneyAdapter.verifyWebhookSignature('payload', hmac('test-secret', 'tampered'))).toBe(false);
  });

  it('mtn momo: rejects webhooks when no secret configured', async () => {
    vi.stubEnv('MTN_MOMO_WEBHOOK_SECRET', '');
    const { mtnMomoAdapter } = await import('../src/modules/payments/providers/mtn-momo.adapter');
    expect(mtnMomoAdapter.verifyWebhookSignature('payload', 'whatever')).toBe(false);
  });

  it('mtn momo: validates a correct HMAC signature', async () => {
    vi.stubEnv('MTN_MOMO_WEBHOOK_SECRET', 'test-secret');
    const { mtnMomoAdapter } = await import('../src/modules/payments/providers/mtn-momo.adapter');
    expect(mtnMomoAdapter.verifyWebhookSignature('payload', hmac('test-secret', 'payload'))).toBe(true);
    expect(mtnMomoAdapter.verifyWebhookSignature('payload', hmac('test-secret', 'tampered'))).toBe(false);
  });

  it('exposes the adapter names', async () => {
    const { orangeMoneyAdapter } = await import('../src/modules/payments/providers/orange-money.adapter');
    const { mtnMomoAdapter } = await import('../src/modules/payments/providers/mtn-momo.adapter');
    expect(orangeMoneyAdapter.name).toBe('ORANGE_MONEY');
    expect(mtnMomoAdapter.name).toBe('MTN_MOMO');
  });
});

const SKIP = !process.env.DATABASE_URL || process.env.SKIP_INTEGRATION === '1';

describe.skipIf(SKIP)('Payment webhook integration', () => {
  it('rejects unknown providerRef', async () => {
    const { buildApp } = await import('../src/app');
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook/orange',
      headers: { 'x-signature': 'mock' },
      payload: { providerRef: 'OM_does_not_exist', status: 'COMPLETED', amount: 1000 },
    });
    expect([401, 404]).toContain(res.statusCode);
    await app.close();
  });
});
