# WATSIM Backend — API Reference

All routes prefixed with `/api/v1`. Set `BASE=http://localhost:3001/api/v1` for the examples below.

Authentication: send `Authorization: Bearer <accessToken>` on protected routes.
All money values are integers in **XAF** (FCFA, no decimals).

---

## Health
```bash
curl http://localhost:3001/health
```

## Auth

### Register
```bash
curl -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@watsim.cm","phone":"+237699000111","password":"Passw0rd!","fullName":"Jane Doe"}'
```

### Login
```bash
curl -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@watsim.cm","password":"Admin@123"}'
```

### Refresh
```bash
curl -X POST $BASE/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refresh>"}'
```

### Logout
```bash
curl -X POST $BASE/auth/logout -H 'Content-Type: application/json' -d '{"refreshToken":"<refresh>"}'
```

### PIN Login (for mobile apps - phone + 4-6 digit PIN)
```bash
curl -X POST $BASE/auth/login-pin \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+237699000001","pin":"1234"}'
```
Returns same shape as /login (user + accessToken + refreshToken). Use this for Flutter customer login.

### Set / Change PIN (protected)
```bash
curl -X POST $BASE/auth/set-pin \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pin":"5678"}'
```
Call after login or during onboarding to set the mobile PIN. Requires valid JWT.

### Register with initial PIN (optional)
```bash
curl -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@watsim.cm","phone":"+237699000111","password":"Passw0rd!","fullName":"Jane Doe","initialPin":"1234"}'
```
If initialPin provided, user can immediately login with phone+pin.

### KYC document upload
Multipart: `type` (NATIONAL_ID | PASSPORT | DRIVERS_LICENSE), `file` (ID image), optional `selfie` (face photo).
When a selfie is provided and `USE_SMILE_ID=true`, Smile ID Job Type 1 (Biometric KYC) is used; otherwise Job Type 4 (Enhanced KYC).
```bash
curl -X POST $BASE/auth/kyc/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F type=NATIONAL_ID \
  -F file=@/path/to/id.jpg \
  -F selfie=@/path/to/selfie.jpg
```

### Smile ID callback (server-to-server)
Public endpoint; Smile ID posts results here. Signature is verified with HMAC-SHA256 using `SMILE_ID_API_KEY`.
Configure `SMILE_ID_CALLBACK_URL=https://your-domain.com/api/v1/auth/kyc/webhook/smile-id`.
```
POST /auth/kyc/webhook/smile-id
```

---

## Users

```bash
curl $BASE/users/me -H "Authorization: Bearer $TOKEN"
curl -X PUT $BASE/users/me -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"fullName":"Jane D."}'
curl "$BASE/users/me/transactions?page=1&limit=20" -H "Authorization: Bearer $TOKEN"
curl $BASE/users/me/purchases -H "Authorization: Bearer $TOKEN"
```

---

## BNPL (customer-only)

### Simulate
```bash
curl -X POST $BASE/bnpl/simulate -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"productId":"<uuid>","instalmentCount":3}'
```

### Purchase
```bash
curl -X POST $BASE/bnpl/purchase -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"productId":"<uuid>","instalmentCount":3,"paymentProvider":"ORANGE_MONEY","phone":"+237699000111"}'
```

### Purchase detail
```bash
curl $BASE/bnpl/purchases/<purchaseId> -H "Authorization: Bearer $TOKEN"
```

### Repay an instalment
```bash
curl -X POST $BASE/bnpl/purchases/<purchaseId>/repay -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"instalmentId":"<uuid>","paymentProvider":"MTN_MOMO","phone":"+237699000111"}'
```

---

## Merchants

### Public
```bash
curl -X POST $BASE/merchants/register -H 'Content-Type: application/json' \
  -d '{"email":"shop@x.cm","phone":"+237699000222","password":"Passw0rd!","fullName":"Owner","businessName":"X Shop","category":"Mode","city":"Douala"}'
curl $BASE/merchants/<id>
curl $BASE/merchants/<id>/products
```

### Self-service (merchant token)
```bash
curl $BASE/merchant/dashboard -H "Authorization: Bearer $MERCH"
curl "$BASE/merchant/orders?page=1&limit=20" -H "Authorization: Bearer $MERCH"
curl -X POST $BASE/merchant/products -H "Authorization: Bearer $MERCH" \
  -H 'Content-Type: application/json' -d '{"name":"T-shirt","price":15000,"stock":50}'
curl -X PUT $BASE/merchant/products/<id> -H "Authorization: Bearer $MERCH" \
  -H 'Content-Type: application/json' -d '{"price":17000}'
curl -X DELETE $BASE/merchant/products/<id> -H "Authorization: Bearer $MERCH"
```

---

## Payments
```bash
curl -X POST $BASE/payments/initiate -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"transactionId":"<uuid>","provider":"ORANGE_MONEY","phone":"+237699000111"}'

curl $BASE/payments/<transactionId>/status -H "Authorization: Bearer $TOKEN"

# Webhook (provider → us); signature header required when not in mock mode
curl -X POST $BASE/payments/webhook/orange -H 'Content-Type: application/json' \
  -H 'x-signature: <hmac-sha256>' \
  -d '{"providerRef":"OM_xxx","status":"COMPLETED","amount":52000}'

# CamPay webhook (when USE_CAMPAY=true). CamPay POSTs the collection result;
# `reference` is the providerRef returned by /collect/, `external_reference` is
# the WATSIM transactionId we forwarded as our own reference.
curl -X POST $BASE/payments/webhook/campay -H 'Content-Type: application/json' \
  -H 'x-signature: <hmac-sha256>' \
  -d '{"reference":"abc-123","external_reference":"<transactionId>","status":"SUCCESSFUL","amount":"52000"}'
```

---

## Admin (admin token)
```bash
curl "$BASE/admin/users?role=CUSTOMER&kycStatus=PENDING" -H "Authorization: Bearer $ADMIN"
curl -X PUT $BASE/admin/users/<id>/kyc -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"status":"VERIFIED","note":"OK"}'
curl -X PUT $BASE/admin/users/<id>/credit-limit -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"creditLimit":150000}'
curl "$BASE/admin/merchants?status=PENDING" -H "Authorization: Bearer $ADMIN"
curl -X PUT $BASE/admin/merchants/<id>/status -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"status":"ACTIVE"}'
curl "$BASE/admin/transactions?status=COMPLETED" -H "Authorization: Bearer $ADMIN"
curl $BASE/admin/reports/summary -H "Authorization: Bearer $ADMIN"
```

## Messaging (In-app chat - customer + support)
All routes under `/messages`, require `Authorization: Bearer <customer or user token>`.

### List conversations
```bash
curl $BASE/messages/conversations -H "Authorization: Bearer $TOKEN"
```

### Start support chat (recommended for mobile "Watsim Support")
```bash
curl -X POST $BASE/messages/support/conversation -H "Authorization: Bearer $TOKEN"
```

### Create 1:1 conversation (by user IDs)
```bash
curl -X POST $BASE/messages/conversations -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"participantIds":["<other-user-uuid>"]}'
```

### Get messages (paginated)
```bash
curl "$BASE/messages/conversations/<convId>/messages?limit=50" -H "Authorization: Bearer $TOKEN"
```

### Send message (text or attachment metadata)
```bash
curl -X POST $BASE/messages/conversations/<convId>/messages -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hello, I have a question about my BNPL order"}'
# With attachment (url from prior upload or external):
# -d '{"text":"","attachmentUrl":"https://...","attachmentType":"image"}'
```

### Mark as read
```bash
curl -X POST $BASE/messages/conversations/<convId>/read -H "Authorization: Bearer $TOKEN"
```

**Notes**:
- Conversations are 1:1 or small groups.
- "Watsim Support" conversations are auto-created per user via the support endpoint.
- Attachments: currently store URL + type (integrate with MinIO upload for production).
- Unread counts & lastReadAt are tracked per participant (basic implementation; enhance in queries as needed).
- Mobile app (Flutter) is wired to these endpoints.
