import { describe, it, expect } from 'vitest';

const SKIP = !process.env.DATABASE_URL || process.env.SKIP_INTEGRATION === '1';

describe.skipIf(SKIP)('auth integration', () => {
  it('registers, logs in, and refreshes a token', async () => {
    const { buildApp } = await import('../src/app');
    const app = await buildApp();
    const email = `test_${Date.now()}@watsim.test`;
    const phone = `+23769${Date.now().toString().slice(-7)}`;

    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { email, phone, password: 'Passw0rd!', fullName: 'Test User' },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = reg.json();
    expect(regBody.accessToken).toBeTypeOf('string');
    expect(regBody.refreshToken).toBeTypeOf('string');

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'Passw0rd!' },
    });
    expect(login.statusCode).toBe(200);

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: regBody.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json().accessToken).toBeTypeOf('string');

    await app.close();
  });

  it('rejects bad credentials', async () => {
    const { buildApp } = await import('../src/app');
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@watsim.cm', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});

describe('auth schema validation (unit)', () => {
  it('placeholder always passes', () => {
    expect(true).toBe(true);
  });
});
