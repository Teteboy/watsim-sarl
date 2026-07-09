export const listProductsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      merchantId: { type: 'string' },
      categoryId: { type: 'string' },
      search: { type: 'string' },
      minPrice: { type: 'integer', minimum: 0 },
      maxPrice: { type: 'integer', minimum: 0 },
    },
  },
} as const;

export const stockAdjustmentSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['delta'],
    properties: {
      delta: { type: 'integer', minimum: -1000000, maximum: 1000000 },
    },
  },
} as const;
