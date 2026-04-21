# Pharmacy Management System — Development Guidelines

Auto-generated from feature plan. Last updated: 2026-04-14

## Active Technologies

### Backend
- Python 3.11
- FastAPI
- SQLAlchemy 2.x (async) + asyncpg
- Alembic (migrations)
- pandas + openpyxl (Excel import)
- Pydantic v2
- Gunicorn + Uvicorn workers

### Frontend
- Node.js 20 / Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

### Database
- PostgreSQL 16 via Neon (managed serverless)

### Deployment
- Backend: Ubuntu 22.04, Gunicorn/Uvicorn, NGINX, systemd — DigitalOcean Droplet
- Frontend: DigitalOcean App Platform (GitHub-connected)

## Project Structure

```text
pharmacy-software-khawajgan/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models/          # SQLAlchemy ORM (medicine, sale, sale_item)
│   │   ├── schemas/         # Pydantic v2 schemas
│   │   ├── services/        # inventory_service.py, billing_service.py
│   │   ├── routers/         # medicines, sales, upload, dashboard
│   │   └── utils/           # excel_parser.py, logger.py
│   ├── alembic/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/                 # Next.js App Router pages
│   │   ├── billing/
│   │   ├── inventory/
│   │   ├── import/
│   │   └── components/      # Slip, MedicineTable, BillingForm, StatsCard
│   ├── lib/api.ts
│   └── .env.local.example
└── specs/
    └── 001-pharmacy-system-core/
        ├── spec.md
        ├── plan.md
        ├── research.md
        ├── data-model.md
        ├── quickstart.md
        └── contracts/
```

## Commands

### Backend

```bash
# Setup
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Run dev server
uvicorn app.main:app --reload --port 8000

# Run production (Gunicorn)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000 app.main:app
```

### Frontend

```bash
# Setup
cd frontend && npm install

# Dev
npm run dev

# Build
npm run build && npm run start
```

## Code Style

### Python (Backend)
- Async functions throughout (`async def`, `await`)
- Pydantic v2 for all request/response validation
- SQLAlchemy `AsyncSession` — never use sync session in async routes
- All sale operations inside explicit transaction: `async with session.begin()`
- `SELECT ... FOR UPDATE` on medicine rows during sale to prevent race conditions
- HTTP 400 for business rule violations (insufficient stock)
- HTTP 422 for input validation failures (Pydantic handles automatically)
- Log errors with `logger.exception()` for full stack trace

### TypeScript (Frontend)
- All API calls go through `lib/api.ts` — never inline fetch in components
- Frontend total (`displayTotal`) is UI-only; backend total is authoritative
- Slip component must not render stock values anywhere
- CSS `@media print` to hide nav when printing slip

## Constitution Compliance Reminders

- Stock calculations: BACKEND ONLY — frontend displays, never computes authoritatively
- Every sale: atomic transaction (BEGIN → validate → deduct → insert → COMMIT)
- Stock never goes below zero: validate BEFORE deducting, use FOR UPDATE lock
- Invoice response: MUST NOT include stock fields
- All secrets: environment variables only (DATABASE_URL, API_BASE_URL, PHARMACY_NAME)

## Recent Changes

- 001-pharmacy-system-core: Initial full system — inventory CRUD, billing/sale, Excel import, admin dashboard

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
