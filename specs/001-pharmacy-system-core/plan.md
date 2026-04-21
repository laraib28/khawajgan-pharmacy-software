# Implementation Plan: Pharmacy Management System — Core

**Branch**: `001-pharmacy-system-core` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-pharmacy-system-core/spec.md`

## Summary

Full-stack pharmacy management system. Backend-first development using FastAPI + PostgreSQL
(Neon). The billing module (P1) is the core: atomic sale transactions with stock validation
and deduction, returning an invoice payload rendered as a 300 px thermal-style slip.
Supporting modules: inventory CRUD (P2), Excel bulk import via pandas (P3), admin stats
dashboard (P4). Frontend in Next.js App Router. No Docker; deployed via Gunicorn + NGINX
on DigitalOcean Droplet (backend) and DigitalOcean App Platform (frontend).

## Technical Context

**Language/Version**: Python 3.11 (backend) · Node.js 20 / Next.js 14 (frontend)
**Primary Dependencies**:
- Backend: FastAPI, SQLAlchemy 2.x (async ORM), asyncpg, Alembic (migrations), pandas + openpyxl (Excel), pydantic v2, python-multipart, uvicorn, gunicorn
- Frontend: Next.js 14 App Router, Tailwind CSS, shadcn/ui or plain CSS for slip component

**Storage**: PostgreSQL 16 via Neon (managed serverless Postgres)
**Testing**: pytest + httpx (backend); manual acceptance testing (frontend — no test framework specified)
**Target Platform**: Linux Ubuntu 22.04 LTS (backend droplet); Node runtime on DigitalOcean App Platform (frontend)
**Project Type**: Web application — separate backend/ and frontend/ directories
**Performance Goals**: Sale API p95 < 500 ms; dashboard stats < 1 s; Excel import ≤ 500 rows < 30 s
**Constraints**: Stock never below zero (DB + app enforced); all sale ops atomic; no Docker
**Scale/Scope**: Single pharmacy, single currency, ~10 concurrent users initially

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate Question | Status |
|---|---|---|
| I. Backend Authority | Are ALL calculations (total, stock deduction) done server-side? | ✅ Yes — frontend only displays results |
| I. Backend Authority | Does frontend NEVER store or derive stock? | ✅ Yes — stock only read from API |
| II. Data Integrity | Does DB enforce stock ≥ 0 constraint? | ✅ Yes — CHECK constraint + app-layer pre-validation |
| II. Data Integrity | Is medicine.name unique at DB level? | ✅ Yes — UNIQUE index on medicines.name |
| II. Data Integrity | Is every sale atomic? | ✅ Yes — SQLAlchemy async session transaction |
| III. Clean Architecture | Is InventoryService separate from BillingService? | ✅ Yes — separate service modules |
| IV. API-First Security | No direct DB calls from frontend? | ✅ Yes — all via REST API |
| IV. API-First Security | Secrets in env vars only? | ✅ Yes — DATABASE_URL, API_BASE_URL |
| V. Transactional Consistency | Sale + stock deduction + records in one transaction? | ✅ Yes — explicit BEGIN/COMMIT via SQLAlchemy |
| VI. Observability | Error messages include medicine name + quantities? | ✅ Yes — per FR-022 |
| VI. Observability | Backend errors logged? | ✅ Yes — per FR-024, Python logging |

**All gates PASS.** No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/001-pharmacy-system-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── medicines.md
│   ├── sales.md
│   ├── excel-import.md
│   └── dashboard.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── main.py                  # FastAPI app entry point, CORS, router registration
│   ├── database.py              # Async engine, session factory (Neon/asyncpg)
│   ├── models/
│   │   ├── medicine.py          # SQLAlchemy Medicine ORM model
│   │   ├── sale.py              # SQLAlchemy Sale ORM model
│   │   └── sale_item.py         # SQLAlchemy SaleItem ORM model
│   ├── schemas/
│   │   ├── medicine.py          # Pydantic request/response schemas
│   │   ├── sale.py              # Pydantic sale input + invoice response
│   │   └── dashboard.py         # Pydantic stats response
│   ├── services/
│   │   ├── inventory_service.py # Medicine CRUD logic
│   │   └── billing_service.py   # Sale creation, stock validation, invoice generation
│   ├── routers/
│   │   ├── medicines.py         # GET/POST/PUT /medicines
│   │   ├── sales.py             # POST /sale
│   │   ├── upload.py            # POST /upload-excel
│   │   └── dashboard.py         # GET /dashboard/stats
│   └── utils/
│       ├── excel_parser.py      # pandas-based .xlsx reader and validator
│       └── logger.py            # Centralised logging setup
├── alembic/                     # DB migrations
│   ├── env.py
│   └── versions/
├── alembic.ini
├── requirements.txt
└── .env.example

frontend/
├── app/
│   ├── layout.tsx               # Root layout with nav
│   ├── page.tsx                 # Dashboard home
│   ├── billing/
│   │   └── page.tsx             # Billing screen (patient name + medicine rows)
│   ├── inventory/
│   │   └── page.tsx             # Medicine list + add/update + search
│   ├── import/
│   │   └── page.tsx             # Excel upload UI
│   └── components/
│       ├── Slip.tsx             # Printable 300px thermal slip component
│       ├── MedicineTable.tsx    # Searchable medicine list
│       ├── BillingForm.tsx      # Dynamic medicine row form
│       └── StatsCard.tsx        # Dashboard stat tile
├── lib/
│   └── api.ts                   # Axios/fetch API client (base URL from env)
├── .env.local.example
├── next.config.ts
└── package.json
```

**Structure Decision**: Web application (Option 2) — separate backend/ and frontend/ directories.
Backend is a Python FastAPI application. Frontend is a Next.js 14 App Router application.

## Phase 0: Research — Resolved Decisions

See [research.md](./research.md) for full decision log.

Key decisions:
1. **ORM**: SQLAlchemy 2.x async (vs raw asyncpg / Tortoise ORM) — best ecosystem fit
2. **Migrations**: Alembic — standard SQLAlchemy companion; supports async engines
3. **Excel**: pandas + openpyxl — mature, handles edge cases; pandas for dedup logic
4. **Frontend state**: React state (useState/useReducer) only — no Redux/Zustand needed at this scale
5. **Print**: CSS `@media print` + `window.print()` — no external library needed
6. **CORS**: FastAPI CORSMiddleware — allow App Platform origin in production

## Phase 1: Design — Data Model & Contracts

See [data-model.md](./data-model.md) and [contracts/](./contracts/).

## Development Phases (User Plan Incorporated)

### Phase 1 — Project Setup

**Goal**: Both applications running locally with DB connectivity.

- [ ] Initialize `backend/` Python project with FastAPI, SQLAlchemy, asyncpg, Alembic, pandas
- [ ] Initialize `frontend/` Next.js 14 project
- [ ] Create `.env.example` for both (DATABASE_URL, API_BASE_URL)
- [ ] Configure Alembic with async Neon engine
- [ ] Verify DB connection returns ping from `/health` endpoint

**Output**: Both servers run locally; `/health` returns 200.

---

### Phase 2 — Database Migrations

**Goal**: Schema stable and migration-managed.

- [ ] Write Alembic migration 001: create `medicines` table (id, name UNIQUE, price, stock CHECK ≥ 0, company, created_at)
- [ ] Write Alembic migration 002: create `sales` table (id, patient_name, total_amount, created_at)
- [ ] Write Alembic migration 003: create `sale_items` table (id, sale_id FK, medicine_id FK, quantity, price)
- [ ] Run migrations against Neon; verify schema in Neon console

**Output**: All three tables exist with correct constraints.

---

### Phase 3 — Inventory System (P2 User Story)

**Goal**: Medicine CRUD API + frontend inventory page.

Backend:
- [ ] `Medicine` ORM model + Pydantic schemas (MedicineCreate, MedicineUpdate, MedicineOut)
- [ ] `InventoryService.create_medicine()` — unique name check + insert
- [ ] `InventoryService.update_medicine()` — price/stock update
- [ ] `InventoryService.list_medicines()` — optional search filter (ILIKE)
- [ ] Routers: `POST /medicines`, `GET /medicines?search=`, `PUT /medicines/{id}`
- [ ] Validation: price ≥ 0, stock ≥ 0; 400 on duplicate name

Frontend:
- [ ] `MedicineTable` component — searchable list
- [ ] Add medicine form (name, price, stock, company)
- [ ] Update medicine inline or modal
- [ ] Wire to `GET /medicines` and `POST /medicines`

**Output**: Medicines CRUD working end-to-end.

---

### Phase 4 — Billing System (P1 User Story — CORE)

**Goal**: Complete atomic sale flow.

Backend:
- [ ] `Sale` + `SaleItem` ORM models + Pydantic schemas
- [ ] `BillingService.create_sale()`:
  - Open async transaction
  - Validate all items have sufficient stock (fail fast, rollback all)
  - Deduct stock for each item
  - Create `sales` row
  - Create `sale_items` rows with price snapshot
  - Calculate total = Σ(quantity × price)
  - Commit; return invoice payload
- [ ] Router: `POST /sale`
- [ ] Error: HTTP 400 with medicine name + requested/available on stock failure

Frontend:
- [ ] `BillingForm` — patient name input, dynamic medicine row (select + quantity)
- [ ] Real-time display total (UI sum; NOT sent to backend as authoritative)
- [ ] Submit → `POST /sale` → receive invoice
- [ ] Render `Slip` component with invoice data
- [ ] `window.print()` trigger for slip

**Output**: Full billing flow — sale recorded, stock deducted, slip printed.

---

### Phase 5 — Slip Generation

**Goal**: Print-quality thermal receipt.

- [ ] `Slip.tsx`: 300 px container, monospace font, CSS `@media print` hides nav
- [ ] Layout: header (PHARMACY_NAME from env), date, patient name, items table, total, footer
- [ ] Verify: stock values NOT rendered
- [ ] Test print dialog in browser

**Output**: Slip prints correctly without stock fields.

---

### Phase 6 — Excel Import (P3 User Story)

**Goal**: Bulk medicine upload via .xlsx.

Backend:
- [ ] `excel_parser.py`: read with `pandas.read_excel()`, validate columns, drop duplicates, replace nulls
- [ ] `POST /upload-excel`: accept `multipart/form-data`, reject non-.xlsx, call parser, bulk insert
- [ ] Skip names that already exist in DB (no overwrite)
- [ ] Return: `{ inserted: N, skipped: M, errors: [...] }`

Frontend:
- [ ] File picker (`.xlsx` accept filter), upload button
- [ ] Display success/failure summary from response

**Output**: Excel import functional with clear result reporting.

---

### Phase 7 — Admin Dashboard (P4 User Story)

**Goal**: System metrics overview with low-stock alerts.

Backend:
- [ ] `GET /dashboard/stats`: single query returning medicine count, sale count, total stock sum
- [ ] `GET /medicines?low_stock=true` or include low-stock list in stats response

Frontend:
- [ ] `StatsCard` tiles: total medicines, total sales, remaining stock
- [ ] Low-stock alert list: medicines with stock ≤ 10

**Output**: Dashboard shows live counts and flags low-stock items.

---

### Phase 8 — Deployment

**Goal**: System live and accessible.

Backend (DigitalOcean Droplet):
- [ ] Provision Ubuntu 22.04 droplet
- [ ] Install Python 3.11, pip, nginx
- [ ] Clone repo, install requirements, set `.env`
- [ ] Create systemd service: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app`
- [ ] Configure NGINX reverse proxy → localhost:8000
- [ ] Open firewall ports 80/443

Frontend (App Platform):
- [ ] Connect GitHub repo; set build command `npm run build`; set env var `NEXT_PUBLIC_API_BASE_URL`
- [ ] Deploy; verify frontend hits backend API

**Output**: System publicly accessible.

---

### Phase 9 — Testing & Polish

**Goal**: Production-ready stability.

- [ ] Test all edge cases: zero quantity, duplicate medicine in sale, 0-row Excel, missing columns
- [ ] Verify stock never goes negative under concurrent submissions
- [ ] Confirm invoice never shows stock
- [ ] Fix identified bugs; refine UI spacing/fonts

**Output**: All acceptance criteria from spec.md verified.

## Complexity Tracking

> No constitution violations — no entries required.
