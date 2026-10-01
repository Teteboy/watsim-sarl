import { describe, it, expect } from 'vitest';

const SKIP = !process.env.DATABASE_URL || process.env.SKIP_INTEGRATION === '1';

describe.skipIf(SKIP)('auth integration', () => {
  it('registers (phone + PIN), logs in with PIN, and refreshes a token', async () => {
    const { buildApp } = await import('../src/app');
    const app = await buildApp();
    const phone = `+23769${Date.now().toString().slice(-7)}`;

    const reg = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { phone, pin: '1234', fullName: 'Test User' },
    });
    expect(reg.statusCode).toBe(201);
    const regBody = reg.json();
    expect(regBody.accessToken).toBeTypeOf('string');
    expect(regBody.refreshToken).toBeTypeOf('string');
    expect(regBody.user.phone).toBe(phone);

    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { phone, pin: '1234' },
    });
    expect(dup.statusCode).toBe(409);

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login-pin',
      payload: { phone, pin: '1234' },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().accessToken).toBeTypeOf('string');

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
