# WATSIM Backend — Local Setup

## Prerequisites
- Node.js 20 LTS
- Docker & Docker Compose (for Postgres, Redis, MinIO)
- npm 10+

## 1. Clone and install
```bash
git clone <your-repo-url> watsim
cd watsim/backend
cp .env.example .env
npm install
```

## 2. Start infrastructure (Postgres / Redis / MinIO)
```bash
docker compose up -d db redis minio
```

The default Postgres credentials are:
- user: `watsim`
- password: `allpha01`
- db: `watsim_db`
- port: `5432`

## 3. Prisma migrate & seed
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```

## 4. Run the API
```bash
npm run dev
```
The API will listen on `http://localhost:3001/api/v1`. Health check:
```bash
curl http://localhost:3001/health
```

## 5. Run all containers together (API + DB + Redis + MinIO)
```bash
docker compose up --build
```

## 6. Seed credentials
| Role     | Email                  | Password      |
|----------|------------------------|---------------|
| Admin    | admin@watsim.cm        | Admin@123     |
| Merchant | techshop@watsim.cm     | Merchant@123  |
| Merchant | fashion@watsim.cm      | Merchant@123  |
| Merchant | homeplus@watsim.cm     | Merchant@123  |
| Customer | customer1@watsim.cm    | Customer@123  |
| Customer | customer2..10@watsim.cm | Customer@123 |

## 7. Run tests
Unit tests (pure logic) always run:
```bash
npm test
```
Integration tests run when `DATABASE_URL` is set and `SKIP_INTEGRATION` is not `1`.

## 8. Frontend
At the **repository root** (not `backend/`):
```bash
cp .env.example .env       # sets VITE_API_BASE_URL=http://localhost:3001/api/v1
npm install
npm run dev
```

## 9. Useful commands
```bash
npm run db:studio          # Prisma Studio (DB browser at :5555)
npx prisma migrate reset   # Drop and re-create DB (dev only!)
docker compose logs -f api # tail backend logs
```

## 10. MinIO console
http://localhost:9001 — user `minioadmin` / pass `minioadmin`.
The bucket `watsim-files` is created on first KYC upload.

## 11. Environment variable reference
See `.env.example`. Critical secrets to change before any non-dev deployment:
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (each ≥ 32 chars)
- `STORAGE_*` credentials
- `ORANGE_MONEY_*`, `MTN_MOMO_*` (set `USE_MOCK_PAYMENTS=false` in production once configured)
- `DATABASE_URL` (use a managed Postgres URI in production)
