export const initiatePaymentSchema = {
  body: {
    type: 'object',
    required: ['transactionId', 'provider', 'phone'],
    properties: {
      transactionId: { type: 'string' },
      provider: { type: 'string', enum: ['ORANGE_MONEY', 'MTN_MOMO'] },
      phone: { type: 'string', minLength: 8 },
    },
  },
} as const;

export const webhookSchema = {
  body: {
    type: 'object',
    required: ['providerRef', 'status'],
    properties: {
      providerRef: { type: 'string' },
      status: { type: 'string', enum: ['COMPLETED', 'FAILED'] },
      amount: { type: 'integer' },
    },
  },
} as const;
