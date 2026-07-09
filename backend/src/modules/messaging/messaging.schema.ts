export const createConversationSchema = {
  body: {
    type: 'object',
    properties: {
      participantIds: {
        type: 'array',
        items: { type: 'string' },
      },
      participantPhones: {
        type: 'array',
        items: { type: 'string' },
      },
      title: { type: 'string', maxLength: 100 },
      isSupport: { type: 'boolean' },

    },
  },
} as const;

export const sendMessageSchema = {
  body: {
    type: 'object',
    properties: {
      text: { type: 'string', maxLength: 2000 },
      attachmentUrl: { type: 'string' },
      attachmentType: { type: 'string', enum: ['image', 'file', 'audio'] },
    },
  },
} as const;

export const markReadSchema = {
  body: {
    type: 'object',
    properties: {},
  },
} as const;
