# WATSIM Backend — Local Setup

> Seed data is for isolated development only. Never seed production. Rotate known demo passwords (`Admin@123`, `Merchant@123`, `Customer@123`) immediately if deployed.

## Prerequisites
- Node.js 20 LTS, npm 10+
- Docker & Docker Compose for PostgreSQL and Redis

## 1. Install and configure
```bash
cd backend
cp .env.example .env
npm install
```

Edit `.env` before starting anything. Generate distinct `POSTGRES_PASSWORD` and `REDIS_PASSWORD` with `openssl rand -hex 32`; set matching passwords in `DATABASE_URL` and `REDIS_URL`. Use unique JWT secrets (`openssl rand -hex 32` or longer). For a locally run API, both URL hosts are `127.0.0.1`; Compose overrides URLs to use internal service names when running the API container. Do not commit `.env`.

## 2. Start infrastructure
```bash
docker compose up -d db redis
```

PostgreSQL user: `watsim`, password: `<your-db-password>` (your `POSTGRES_PASSWORD`), database: `watsim_db`, localhost port: `5432`. Redis requires `REDIS_PASSWORD` and binds to localhost port `6379`.

## 3. Migrate and seed (development only)
```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

Seed demo accounts include `admin@watsim.cm` (`Admin@123`), merchant accounts (`Merchant@123`), and customer accounts (`Customer@123`). Never use these accounts or run this seed in production. Use `prisma migrate deploy` for production schema updates, not `migrate dev` or `migrate reset`.

## 4. Run the API
```bash
npm run dev
curl http://localhost:3001/health
```

API base URL: `http://localhost:3001/api/v1`.

Alternatively, run API + PostgreSQL + Redis together:
```bash
docker compose up --build
```

## 5. Upload persistence (no MinIO)

Storage uses the local filesystem, not MinIO. For the local process, `UPLOADS_DIR=uploads`. Compose mounts the named `uploads` volume at `/app/uploads` and sets `UPLOADS_DIR` accordingly. The container runs as `node` (UID 1000); existing volumes or bind mounts must be writable by that user. Back up uploads separately from the database. Do not delete volumes containing data you need.

## 6. Tests and frontend
```bash
npm test
```

Integration tests require `DATABASE_URL` and `SKIP_INTEGRATION` not set to `1`; use a disposable test database.

From the repository root in another terminal:
```bash
cp .env.example .env
npm install
npm run dev
```

Frontend `VITE_API_BASE_URL` should be `http://localhost:3001/api/v1`.

## 7. Environment reference and production

See `.env.example` and `../deploy/backend.env.example`. Configure payment, SMS and KYC credentials before enabling real integrations; never deploy mock payments in production. Use `CAMPAY_USERNAME` / `CAMPAY_PASSWORD`; production must explicitly set `CAMPAY_BASE_URL=https://www.campay.net` (the app otherwise defaults to demo). Smile ID callback path is `/api/v1/auth/kyc/webhook/smile-id`.

Production deployment, TLS, firewall, ownership and rollback guidance: `../deploy/README.md`.
