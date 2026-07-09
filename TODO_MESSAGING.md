# Messaging fixes (implementation checklist)

- [x] messaging.schema.ts: add `participantPhones?: string[]` (and allow either phone list or user id list)

- [x] messaging.service.ts: add `resolveUserIdsByPhones()` and `getSupportAdminUserId()`


- [ ] messaging.service.ts: update `getOrCreateSupportConversation()` to include support/admin participant
- [ ] messaging.routes.ts: update POST /conversations handler to accept phone-based inputs
- [ ] messaging.routes.ts: wire through resolved participants

- [ ] Update support conversation fetching if needed
- [x] Backend messaging routes: accept `participantPhones`
- [ ] Backend lint/tests


