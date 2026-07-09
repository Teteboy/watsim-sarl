export const simulateSchema = {
  body: {
    type: 'object',
    required: ['productId', 'instalmentCount'],
    properties: {
      productId: { type: 'string' },
      instalmentCount: { type: 'integer', minimum: 1, maximum: 60 },
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
      downPayment: { type: 'integer', minimum: 0, default: 0 },
    },
  },
} as const;

export const purchaseSchema = {
  body: {
    type: 'object',
    required: ['productId', 'instalmentCount', 'paymentProvider', 'phone'],
    properties: {
      productId: { type: 'string' },
      instalmentCount: { type: 'integer', minimum: 1, maximum: 60 },
      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
      paymentProvider: { type: 'string', enum: ['ORANGE_MONEY', 'MTN_MOMO', 'WALLET'] },
      phone: { type: 'string' },
      downPayment: { type: 'integer', minimum: 0, default: 0 },
    },
  },
} as const;

export const repaySchema = {
  body: {
    type: 'object',
    required: ['instalmentId', 'paymentProvider', 'phone'],
    properties: {
      instalmentId: { type: 'string' },
      paymentProvider: { type: 'string', enum: ['ORANGE_MONEY', 'MTN_MOMO', 'WALLET'] },
      phone: { type: 'string' },
    },
  },
} as const;
