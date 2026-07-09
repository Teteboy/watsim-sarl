export const updateProfileSchema = {
  body: {
    type: 'object',
    properties: {
      fullName: { type: 'string', minLength: 2 },
      phone: { type: 'string', minLength: 8 },
    },
    additionalProperties: false,
  },
} as const;

export const paginationSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'integer', minimum: 1, default: 1 },
      limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
} as const;
