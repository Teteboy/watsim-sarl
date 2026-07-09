export const listFilterSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      role: { type: 'string', enum: ['ADMIN', 'MERCHANT', 'CUSTOMER'] },
      kycStatus: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED'] },
      status: { type: 'string' },
      search: { type: 'string' },
    },
  },
} as const;

export const kycDecisionSchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: {
      status: { type: 'string', enum: ['VERIFIED', 'REJECTED'] },
      note: { type: 'string' },
    },
  },
} as const;

export const creditLimitSchema = {
  body: {
    type: 'object',
    required: ['creditLimit'],
    properties: { creditLimit: { type: 'integer', minimum: 0 } },
  },
} as const;

export const merchantStatusSchema = {
  body: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED'] } },
  },
} as const;
