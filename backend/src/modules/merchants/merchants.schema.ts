export const registerMerchantSchema = {
  body: {
    type: 'object',
    required: ['email', 'phone', 'password', 'fullName', 'businessName', 'category', 'city'],
    properties: {
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', minLength: 8 },
      password: { type: 'string', minLength: 8 },
      fullName: { type: 'string', minLength: 2 },
      businessName: { type: 'string', minLength: 2 },
      category: { type: 'string', minLength: 2 },
      city: { type: 'string', minLength: 2 },
      settings: { type: 'object' },
    },
  },
} as const;

export const productCreateSchema = {
  body: {
    type: 'object',
    required: ['name', 'categoryId'],
    properties: {
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      price: { type: 'integer', minimum: 0 },
      costPrice: { type: 'integer', minimum: 0 },
      stock: { type: 'integer', minimum: 0, default: 0 },
      imageUrl: { type: 'string' },
      bnplEligible: { type: 'boolean', default: true },
      categoryId: { type: 'string', minLength: 1 },
    },
  },
} as const;

export const productUpdateSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2 },
      description: { type: 'string' },
      price: { type: 'integer', minimum: 0 },
      costPrice: { type: 'integer', minimum: 0 },
      stock: { type: 'integer', minimum: 0 },
      imageUrl: { type: 'string' },
      bnplEligible: { type: 'boolean' },
      isActive: { type: 'boolean' },
      categoryId: { type: 'string' },
    },
    additionalProperties: false,
  },
} as const;
