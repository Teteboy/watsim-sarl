export const listPublicitiesSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      status: { type: 'string' },
      type: { type: 'string' },
      search: { type: 'string' },
    },
  },
} as const;

export const createPublicitySchema = {
  body: {
    type: 'object',
    required: ['name', 'type', 'position'],
    properties: {
      name: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      aim: { type: 'string' },
      location: { type: 'string' },
      phoneNumber: { type: 'string' },
      merchantId: { type: 'string' },
      type: { type: 'string' },
      position: { type: 'string' },
      budget: { type: 'integer', minimum: 0 },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      imageUrl: { type: 'string' },
    },
  },
} as const;

export const updatePublicitySchema = {
  params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      aim: { type: 'string' },
      location: { type: 'string' },
      phoneNumber: { type: 'string' },
      merchantId: { type: 'string' },
      status: { type: 'string' },
      type: { type: 'string' },
      position: { type: 'string' },
      budget: { type: 'integer', minimum: 0 },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      imageUrl: { type: 'string' },
    },
  },
} as const;
