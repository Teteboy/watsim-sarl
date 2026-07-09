process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'test_access_secret_test_access_secret_test_access_secret';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_test_refresh_secret_test_refresh_secret';
process.env.USE_MOCK_PAYMENTS = process.env.USE_MOCK_PAYMENTS || 'true';
process.env.SKIP_INTEGRATION = process.env.SKIP_INTEGRATION || '1';
