---
description: "Task list for Pharmacy Management System — Core"
---

# Tasks: Pharmacy Management System — Core

**Input**: Design documents from `/specs/001-pharmacy-system-core/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅
**Branch**: `001-pharmacy-system-core`

**Tests**: Not explicitly requested — no test tasks generated. Acceptance verified manually
via smoke tests in `quickstart.md`.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story — [US1] Billing, [US2] Inventory, [US3] Excel Import, [US4] Dashboard
- Every task includes exact file path

## Path Conventions

- Backend: `backend/` at repository root
- Frontend: `frontend/` at repository root
- Migrations: `backend/alembic/versions/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Both applications initialized, dependencies installed, project structure ready.

- [x] T001 Create `backend/` Python project structure: `app/models/`, `app/schemas/`, `app/services/`, `app/routers/`, `app/utils/`, `alembic/versions/`
- [x] T002 Create `backend/requirements.txt` with: fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic, pandas, openpyxl, python-multipart, pydantic[email], python-dotenv
- [x] T003 [P] Create `backend/.env.example` with: `DATABASE_URL`, `PHARMACY_NAME`, `FRONTEND_ORIGIN`
- [x] T004 Initialize Next.js 14 App Router project in `frontend/` (`npx create-next-app@latest frontend --typescript --tailwind --app`)
- [x] T005 [P] Create `frontend/.env.local.example` with: `NEXT_PUBLIC_API_BASE_URL`
- [x] T006 [P] Create `frontend/lib/api.ts` — centralised fetch client that reads `NEXT_PUBLIC_API_BASE_URL`; export typed helper functions `get()`, `post()`, `postForm()`

**Checkpoint**: `backend/` structure exists with requirements.txt; `frontend/` runs `npm run dev` without errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, ORM models, Pydantic schemas, and the single shared endpoint
(GET /medicines) that both US1 and US2 depend on. No user story work can begin until this
phase is complete.

**⚠️ CRITICAL**: All user story phases depend on this phase being complete.

- [x] T007 Create `backend/app/database.py` — async SQLAlchemy engine using `DATABASE_URL` (asyncpg driver, `ssl=require`), `AsyncSession` factory, `get_db()` dependency, and `Base` declarative base
- [x] T008 [P] Create `backend/app/models/medicine.py` — `Medicine` ORM model: id, name (String UNIQUE), price (Numeric 10,2, CHECK ≥ 0), stock (Integer, CHECK ≥ 0), company (nullable), created_at; relationship to SaleItem
- [x] T009 [P] Create `backend/app/models/sale.py` — `Sale` ORM model: id, patient_name, total_amount (Numeric 10,2), created_at; relationship to SaleItem
- [x] T010 [P] Create `backend/app/models/sale_item.py` — `SaleItem` ORM model: id, sale_id (FK→sales CASCADE), medicine_id (FK→medicines), quantity (Integer, CHECK ≥ 1), price (Numeric 10,2); relationships to Sale and Medicine
- [x] T011 [P] Create `backend/app/schemas/medicine.py` — Pydantic v2 schemas: `MedicineCreate` (name, price ≥ 0, stock ≥ 0, company optional), `MedicineUpdate` (price optional ≥ 0, stock optional ≥ 0), `MedicineOut` (id, name, price, stock, company, created_at; `from_attributes=True`)
- [x] T012 [P] Create `backend/app/schemas/sale.py` — Pydantic v2 schemas: `SaleItemInput` (medicine_id int, quantity int ≥ 1), `SaleCreate` (patient_name str, items list min 1), `InvoiceItem` (name, quantity, price, amount), `InvoiceOut` (sale_id, patient_name, created_at, items, total_amount)
- [x] T013 [P] Create `backend/app/schemas/dashboard.py` — `DashboardStats` schema: total_medicines int, total_sales int, total_stock int, low_stock_medicines list[MedicineOut]
- [x] T014 [P] Create `backend/app/utils/logger.py` — configure Python `logging` with format `%(asctime)s %(levelname)s %(name)s: %(message)s`; export `get_logger(name)` helper
- [x] T015 Configure Alembic: create `backend/alembic.ini` (script_location=alembic); update `backend/alembic/env.py` to import `Base` from `app.database`, use sync engine wrapper for async engine
- [x] T016 Write `backend/alembic/versions/001_create_medicines.py` — create `medicines` table with all columns, `LOWER(name)` unique index, CHECK constraints on price and stock
- [x] T017 Write `backend/alembic/versions/002_create_sales.py` — create `sales` table
- [x] T018 Write `backend/alembic/versions/003_create_sale_items.py` — create `sale_items` table with FKs (CASCADE on sale_id), CHECK quantity ≥ 1
- [x] T019 Run `alembic upgrade head` from `backend/`; verify all three tables exist in Neon console with correct columns and constraints
- [x] T020 Create `backend/app/services/inventory_service.py` — implement `list_medicines(db, search: str | None) -> list[Medicine]` using `ILIKE` filter on `LOWER(name)` when search provided
- [x] T021 Create `backend/app/routers/medicines.py` — implement `GET /medicines?search=` route using `inventory_service.list_medicines()`; return `list[MedicineOut]`
- [x] T022 Create `backend/app/main.py` — FastAPI app, `CORSMiddleware` (origin from `FRONTEND_ORIGIN` env var), include medicines router, `GET /health` returns `{"status": "ok"}`, global exception logging
- [x] T023 Create `frontend/app/layout.tsx` — root layout with `<nav>` links to: Billing, Inventory, Import; wraps `{children}`

**Checkpoint**: `GET /health` → 200; `GET /medicines` → `[]`; all three tables exist in DB;
frontend loads with nav visible.

---

## Phase 3: User Story 1 — Sell Medicines & Generate Invoice (Priority: P1) 🎯 MVP

**Goal**: Complete atomic sale flow — validate stock, deduct, record, return printable invoice.

**Independent Test**: Seed one medicine via direct DB insert or curl. Submit a POST /sale.
Verify invoice returned (no stock field), stock reduced in DB, one sales + sale_items row.
Print the slip. Confirm "Refund within 7 days" footer visible; stock NOT visible anywhere.

### Implementation for User Story 1

- [x] T024 [P] [US1] Implement `BillingService.create_sale()` in `backend/app/services/billing_service.py`:
  open async transaction → `SELECT medicine FOR UPDATE` for each item → validate stock (HTTP 400
  with medicine name + requested/available on failure, rollback all) → deduct stock → INSERT sales
  row → INSERT sale_items rows with price snapshot → calculate total = Σ(qty × price) → COMMIT →
  return InvoiceOut payload (NO stock fields)
- [x] T025 [US1] Implement `POST /sale` in `backend/app/routers/sales.py` — accept `SaleCreate`, call `billing_service.create_sale()`, return `InvoiceOut` 200 on success; register router in `backend/app/main.py`
- [x] T026 [P] [US1] Create `frontend/app/components/Slip.tsx` — 300 px fixed-width container, monospace font family, sections: header (`NEXT_PUBLIC_PHARMACY_NAME` or env), date, patient name, items table (name | qty | price | amount columns), total row, "Refund within 7 days" footer; `@media print` CSS hides `<nav>` and `.no-print` elements; accepts `invoice: InvoiceOut` prop; MUST NOT render any stock value
- [x] T027 [P] [US1] Create `frontend/app/components/BillingForm.tsx` — state: patientName (string), items (array of {medicineId, medicineName, quantity, price}); fetches medicines list on mount via `GET /medicines`; renders: patient name input, dynamic medicine rows (dropdown from medicines list + quantity input), computed display total (UI-only sum), "Generate Sale" button; calls `POST /sale` on submit; on success passes invoice to parent; on error displays message
- [x] T028 [US1] Create `frontend/app/billing/page.tsx` — compose `BillingForm` + conditional `Slip` rendering; show Slip component only after successful sale; include "Print" button that calls `window.print()`

**Checkpoint**: POST /sale deducts stock atomically; invoice returned without stock; slip prints
at 300 px with correct layout; insufficient stock returns descriptive 400 error.

---

## Phase 4: User Story 2 — Manage Medicine Inventory (Priority: P2)

**Goal**: Full inventory CRUD — add medicines, update price/stock, search by name.

**Independent Test**: Add "Calpol" via POST /medicines. Verify it appears in GET /medicines.
Update price via PUT /medicines/{id}. Search "cal" — only Calpol returned. Try duplicate
name — expect 400. Try price −10 — expect 422.

### Implementation for User Story 2

- [x] T029 [P] [US2] Extend `backend/app/services/inventory_service.py` — add `create_medicine(db, data: MedicineCreate) -> Medicine`: check LOWER(name) uniqueness → raise HTTP 400 if duplicate → INSERT → return Medicine ORM object
- [x] T030 [P] [US2] Add `update_medicine(db, medicine_id: int, data: MedicineUpdate) -> Medicine` to `backend/app/services/inventory_service.py`: fetch by id → raise HTTP 404 if not found → apply non-None fields → commit → return updated object
- [x] T031 [US2] Add `POST /medicines` to `backend/app/routers/medicines.py` — accept `MedicineCreate`, call `inventory_service.create_medicine()`, return `MedicineOut` 201
- [x] T032 [US2] Add `PUT /medicines/{id}` to `backend/app/routers/medicines.py` — accept `MedicineUpdate`, call `inventory_service.update_medicine()`, return `MedicineOut` 200
- [x] T033 [P] [US2] Create `frontend/app/components/MedicineTable.tsx` — props: `medicines: MedicineOut[]`; renders searchable table (client-side filter on name); each row shows: name, price, stock, company; inline "Edit" opens a small form with price + stock inputs that calls `PUT /medicines/{id}`
- [x] T034 [US2] Create `frontend/app/inventory/page.tsx` — fetches `GET /medicines` on mount + on search input change; renders: search input, "Add Medicine" form (name, price, stock, company → `POST /medicines`), `MedicineTable` with edit capability; shows validation errors inline

**Checkpoint**: POST /medicines creates medicine; duplicate name → 400; PUT /medicines/{id}
updates price; search returns filtered results; inventory page works end-to-end.

---

## Phase 5: User Story 3 — Bulk Import via Excel (Priority: P3)

**Goal**: Upload .xlsx file; validate, deduplicate, and bulk-insert medicines without overwriting existing ones.

**Independent Test**: Upload a valid .xlsx with 10 rows (2 name-duplicates, 1 null company).
Expect inserted=8, skipped=2. Upload non-.xlsx — expect 415. Upload missing "price" column — expect 422 with column list.

### Implementation for User Story 3

- [x] T035 [P] [US3] Create `backend/app/utils/excel_parser.py` — `parse_excel(file_bytes: bytes) -> ParseResult`: use `pd.read_excel(BytesIO(file_bytes), engine='openpyxl')`; validate required columns {name, price, stock, company} → raise ValueError listing missing; drop rows where name/price/stock are null (count as errors); fill null company with `""`; drop duplicate names keeping first; validate price ≥ 0 and stock ≥ 0 per row (invalid rows → errors list); return `ParseResult(rows: list[dict], skipped: int, errors: list[{row, reason}])`
- [x] T036 [US3] Implement `POST /upload-excel` in `backend/app/routers/upload.py` — accept `UploadFile`, reject non-.xlsx (415); call `excel_parser.parse_excel()`; for each parsed row check if name already in DB → skip if exists; bulk INSERT remaining; return `{inserted, skipped, errors}`; wrap inserts in one DB transaction (rollback on failure); register router in `backend/app/main.py`
- [x] T037 [US3] Create `frontend/app/import/page.tsx` — file input restricted to `.xlsx`; "Upload" button calls `POST /upload-excel` with `FormData`; displays result: "Inserted: N, Skipped: M" and error list; shows loading state during upload

**Checkpoint**: Valid .xlsx inserts correctly with dedup; existing medicines not overwritten;
missing column → 422; non-.xlsx → 415; 0-valid-rows → message "No valid records to import".

---

## Phase 6: User Story 4 — Admin Dashboard Overview (Priority: P4)

**Goal**: Single-page view of pharmacy metrics (medicines, sales, total stock) with low-stock alerts.

**Independent Test**: Verify dashboard shows correct counts matching DB state. Medicine with
stock ≤ 10 appears in low-stock list. All values update within 5 seconds of any change.

### Implementation for User Story 4

- [x] T038 [P] [US4] Implement `GET /dashboard/stats` in `backend/app/routers/dashboard.py` — single async query: COUNT(medicines), COUNT(sales), COALESCE(SUM(medicines.stock), 0); second query: medicines WHERE stock ≤ 10 ORDER BY stock ASC; return `DashboardStats`; register router in `backend/app/main.py`
- [x] T039 [P] [US4] Create `frontend/app/components/StatsCard.tsx` — props: `label: string`, `value: number | string`; renders a simple card with large value and label; accepts optional `className` for styling
- [x] T040 [US4] Update `frontend/app/page.tsx` (dashboard home) — fetch `GET /dashboard/stats` on mount; render three `StatsCard` tiles: "Total Medicines", "Total Sales", "Total Stock"; render low-stock alert section: list of medicines with stock ≤ 10, each row highlighted in warning colour (yellow/orange); show "All medicines well-stocked" if list empty

**Checkpoint**: Dashboard shows correct aggregate values; low-stock medicines (stock ≤ 10) appear
highlighted; empty low-stock state handled gracefully.

---

## Phase 7: Deployment

**Purpose**: System live and publicly accessible on DigitalOcean infrastructure.

- [x] T041 Create `backend/deploy/pharmacy-backend.service` — systemd unit: `ExecStart` runs Gunicorn with 4 UvicornWorker processes bound to `127.0.0.1:8000`, `WorkingDirectory` set to app root, `Restart=always`
- [x] T042 Create `backend/deploy/nginx.conf` — server block: listen 80, `proxy_pass http://127.0.0.1:8000`, set `proxy_set_header` for Host and X-Real-IP
- [x] T043 [P] Provision Ubuntu 22.04 DigitalOcean Droplet; install Python 3.11, pip, nginx, git
- [x] T044 Deploy backend to Droplet: clone repo, create venv, `pip install -r requirements.txt`, create `.env` with production values, run `alembic upgrade head`, copy systemd service file, `systemctl enable --now pharmacy-backend`
- [x] T045 Configure NGINX: copy `nginx.conf` to `/etc/nginx/sites-available/pharmacy`, symlink to `sites-enabled/`, `nginx -t && systemctl reload nginx`
- [x] T046 Deploy frontend on DigitalOcean App Platform: connect GitHub repo, set build command `cd frontend && npm run build`, run command `cd frontend && npm start`, set env var `NEXT_PUBLIC_API_BASE_URL=https://<droplet-ip-or-domain>`
- [x] T047 Validate live system: run all smoke tests from `specs/001-pharmacy-system-core/quickstart.md` against production URLs

**Checkpoint**: `GET https://<api>/health` → 200; frontend loads; full billing flow works on production.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Stability, edge case coverage, and UI quality across all user stories.

- [x] T048 [P] Add global exception handler to `backend/app/main.py` — catch unhandled exceptions, log with `logger.exception()`, return `{"detail": "Internal server error"}` with 500
- [x] T049 [P] Add loading states (`isLoading` boolean) and inline error messages to all four frontend pages: `billing/page.tsx`, `inventory/page.tsx`, `import/page.tsx`, `page.tsx` (dashboard)
- [x] T050 [P] Audit `frontend/app/components/Slip.tsx` — verify zero occurrences of `stock` in rendered output; add a comment marking the stock-free constraint
- [x] T051 Test all edge cases from `specs/001-pharmacy-system-core/spec.md`:
  - quantity = 0 in sale → 422
  - same medicine twice in one sale items array → consistent behaviour (sum or reject)
  - Excel file with 0 valid rows after deduplication → `"No valid records to import"`
  - DB connection failure mid-transaction → 500 returned, no partial writes
- [x] T052 [P] Final UI polish in `frontend/` — consistent spacing, font sizes, monospace on slip, responsive layout for inventory table on mobile
- [x] T053 Run `quickstart.md` validation checklist end-to-end against production system; mark all items complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user story phases**
- **US1/P1 (Phase 3)**: Depends on Foundational — can start as soon as T019 (migrations run) and T022 (main.py) complete
- **US2/P2 (Phase 4)**: Depends on Foundational — can proceed in parallel with US1 once Foundational is done
- **US3/P3 (Phase 5)**: Depends on Foundational only — independent of US1/US2
- **US4/P4 (Phase 6)**: Depends on Foundational only — independent of US1/US2/US3
- **Deployment (Phase 7)**: Depends on all desired user story phases being complete
- **Polish (Phase 8)**: Depends on Deployment

### User Story Dependencies

- **US1 Billing (P1)**: Needs Foundational (T007–T023); no dependency on US2, US3, or US4
- **US2 Inventory (P2)**: Needs Foundational; extends `inventory_service.py` from T020 — no dependency on US1
- **US3 Excel Import (P3)**: Needs Foundational only; fully independent
- **US4 Dashboard (P4)**: Needs Foundational only; fully independent

### Within Each User Story

- Services before routers
- Models before services (but models are in Foundational phase)
- Backend endpoint before frontend integration
- All tasks marked [P] within a phase can run in parallel

### Parallel Opportunities

```bash
# Phase 2 (Foundational) — run in parallel:
T008  Create models/medicine.py
T009  Create models/sale.py
T010  Create models/sale_item.py
T011  Create schemas/medicine.py
T012  Create schemas/sale.py
T013  Create schemas/dashboard.py
T014  Create utils/logger.py

# Phase 3 (US1) — run in parallel:
T024  BillingService.create_sale()
T026  Slip.tsx component
T027  BillingForm.tsx component
# Then T025 (POST /sale router), T028 (billing page) after T024

# Phase 4 (US2) — run in parallel:
T029  inventory_service.create_medicine()
T030  inventory_service.update_medicine()
T033  MedicineTable.tsx component
# Then T031, T032 (POST/PUT routes) after T029/T030
# Then T034 (inventory page) after T033
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational (T007–T023) — CRITICAL: blocks everything
3. Complete Phase 3: User Story 1 — Billing (T024–T028)
4. **STOP and VALIDATE**: curl `POST /sale` → verify invoice; open billing page; print slip
5. Deploy Phase 7 if ready (backend only sufficient for API validation)

### Incremental Delivery

1. Setup + Foundational → DB + GET /medicines + health endpoint ✅
2. US1 Billing → Sell medicines + print invoice ✅ **(MVP!)**
3. US2 Inventory → Full CRUD UI for managing medicines ✅
4. US3 Excel Import → Bulk upload ✅
5. US4 Dashboard → Admin metrics view ✅
6. Deploy + Polish → Production-ready ✅

### Parallel Team Strategy

With two developers after Foundational is complete:

- **Dev A**: US1 (BillingService, POST /sale, BillingForm, Slip) → most critical path
- **Dev B**: US2 (inventory_service create/update, POST/PUT /medicines, inventory page)
- US3 and US4 can follow in a second round

---

## Notes

- [P] tasks = different files, safe to run concurrently with other [P] tasks in same phase
- [US1]/[US2]/[US3]/[US4] label maps each task to its user story for traceability
- Foundational tasks have NO story label — they serve all user stories
- **Stock is NEVER rendered on Slip.tsx** (constitution non-negotiable — Principle I + VI)
- **SELECT FOR UPDATE** in BillingService is mandatory for concurrent safety (SC-007)
- **Alembic** manages all schema changes; never modify DB schema by hand
- Commit after each task or logical group; verify the endpoint works before moving to the next task
