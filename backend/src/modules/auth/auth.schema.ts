export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'phone', 'password', 'fullName'],
    properties: {
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', minLength: 8 },
      password: { type: 'string', minLength: 8 },
      fullName: { type: 'string', minLength: 2 },
    },
  },
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 1 },
    },
  },
} as const;

export const refreshSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
} as const;

export const logoutSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: { refreshToken: { type: 'string' } },
  },
} as const;

export const pinLoginSchema = {
  body: {
    type: 'object',
    required: ['phone', 'pin'],
    properties: {
      phone: { type: 'string', minLength: 8 },
      pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' },
    },
  },
} as const;

export const setPinSchema = {
  body: {
    type: 'object',
    required: ['pin'],
    properties: {
      pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' },
    },
  },
} as const;

export const registerWithPinSchema = {
  body: {
    type: 'object',
    required: ['phone'],
    properties: {
      phone: { type: 'string', minLength: 8 },
      pin: { type: 'string', minLength: 4, maxLength: 6, pattern: '^[0-9]+$' },
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      fullName: { type: 'string' },
      referralCode: { type: 'string', minLength: 1 },
    },
  },
} as const;
