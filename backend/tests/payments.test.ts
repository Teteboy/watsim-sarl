import { describe, it, expect } from 'vitest';
import { orangeMoneyAdapter } from '../src/modules/payments/providers/orange-money.adapter';
import { mtnMomoAdapter } from '../src/modules/payments/providers/mtn-momo.adapter';

describe('Payment adapters (mock mode)', () => {
  it('orange money: mock signature always valid in mock mode', () => {
    expect(orangeMoneyAdapter.verifyWebhookSignature('payload', 'whatever')).toBe(true);
  });

  it('mtn momo: mock signature always valid in mock mode', () => {
    expect(mtnMomoAdapter.verifyWebhookSignature('payload', 'whatever')).toBe(true);
  });

  it('exposes the adapter names', () => {
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
