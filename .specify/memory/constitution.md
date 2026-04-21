<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 (template) → 1.0.0
Modified principles: All (new — replacing template placeholders with pharmacy domain content)
Added sections:
  - Tech Stack & Deployment (Section 2)
  - Data Models & Business Rules (Section 3)
  - 6 core principles populated
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ — Constitution Check section references pharmacy principles; no structural change needed
  - .specify/templates/spec-template.md ✅ — Aligned; no structural change needed
  - .specify/templates/tasks-template.md ✅ — Aligned; no structural change needed
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Exact original adoption date unknown; set to first commit date 2026-04-14.
  - TODO(DEPLOYMENT_URLS): Production URLs not specified in input; to be added once deployed.
-->

# Pharmacy Management System Constitution

## Core Principles

### I. Backend Authority (NON-NEGOTIABLE)

All business logic, calculations, and stock management MUST reside exclusively in the backend.

- Total amount, price calculations, and stock deductions MUST be computed server-side.
- The frontend is strictly a UI layer: it MUST NOT calculate, store, or derive stock values.
- A UI-side real-time total is allowed for display convenience only; the backend MUST recompute
  and verify the authoritative total before persisting any sale.

**Rationale**: Centralising authority in the backend prevents client-side tampering and ensures
a single, auditable source of truth for all financial and inventory operations.

### II. Data Integrity (NON-NEGOTIABLE)

The database is the sole source of truth for all stock and sales data.

- Stock MUST NEVER go below zero; any request that would cause this MUST be rejected with a
  clear error before any writes occur.
- Medicine names MUST be unique across the system.
- Every sale MUST produce exactly one `sales` record and one or more `sale_items` records.
- All sale operations (stock deduction + record creation) MUST execute atomically inside a
  database transaction; partial writes are not permitted.

**Rationale**: Inventory accuracy is a hard business requirement. Partial or negative stock
states cause unrecoverable billing errors.

### III. Clean Architecture & Separation of Concerns

The codebase MUST follow a clean, modular structure with explicit service boundaries.

- Inventory logic (stock reads/writes) MUST live in a dedicated `InventoryService`.
- Billing logic (sale creation, total calculation, invoice generation) MUST live in a dedicated
  `BillingService`.
- Services MUST NOT directly call each other's internal data-access methods; they communicate
  through well-defined interfaces.
- Frontend pages/components MUST NOT embed business logic; all data fetching goes through
  defined API calls.

**Rationale**: Isolated modules can be tested independently, extended without risk of
cross-contamination, and replaced without system-wide rewrites.

### IV. API-First Security

All data access from the frontend MUST flow exclusively through validated backend API endpoints.

- Direct database access from the frontend is forbidden under any circumstance.
- Every API input MUST be validated and sanitised before processing.
- Secrets (DATABASE_URL, API keys) MUST be stored in environment variables; they MUST NOT be
  hardcoded or committed to source control.
- API endpoints MUST be protected against common injection and traversal attacks (OWASP Top 10).

**Rationale**: A controlled API surface limits the blast radius of any vulnerability and ensures
all operations pass through business-rule validation.

### V. Transactional Consistency

Every operation that modifies more than one entity MUST be wrapped in a database transaction.

- Sale creation: stock deductions + sales record + sale_items records are one atomic unit.
- Excel import: bulk inserts MUST be idempotent (duplicate medicine names deduplicated before
  write) and wrapped in a transaction; failures MUST roll back entirely.
- On any transaction failure the system MUST return a clear error; no partial state may persist.

**Rationale**: Pharmacy billing errors are directly customer-facing. Silent partial writes
corrupt inventory and financial records.

### VI. Observability & Explicit Error Handling

The system MUST surface errors clearly at every layer.

- Backend errors MUST be logged with sufficient context (endpoint, input, stack trace where
  appropriate).
- API responses for error states MUST include a human-readable message and an appropriate HTTP
  status code.
- Insufficient stock MUST return a descriptive rejection (e.g., `"Insufficient stock for
  <medicine_name>: requested <N>, available <M>"`).
- Low-stock alerts MUST be surfaced in the Admin Dashboard.
- Invoice output MUST NOT include stock quantities — stock is an internal operational metric,
  not a customer-facing field.

**Rationale**: Clear, actionable error messages reduce operator mistakes and shorten resolution
time during sales operations.

## Tech Stack & Deployment

### Technology Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Frontend   | Next.js (React)                                 |
| Backend    | FastAPI (Python)                                |
| Database   | PostgreSQL (Neon managed)                       |

### Deployment (NO DOCKER)

**Backend — DigitalOcean Droplet (Ubuntu)**

- Runtime: Gunicorn + Uvicorn workers
- Reverse proxy: NGINX
- Process management: systemd service

**Frontend — DigitalOcean App Platform**

- Source: GitHub repository (auto-deploy on push to main)

**Environment Variables (MUST be set; never hardcoded)**

- `DATABASE_URL` — Neon PostgreSQL connection string
- `API_BASE_URL` — Backend API base URL consumed by the frontend

## Data Models & Business Rules

### Data Models

**medicines**

| Column     | Type      | Constraints            |
|------------|-----------|------------------------|
| id         | integer   | primary key            |
| name       | varchar   | unique, not null       |
| price      | numeric   | not null               |
| stock      | integer   | not null, ≥ 0          |
| company    | varchar   | nullable               |
| created_at | timestamp | default now()          |

**sales**

| Column        | Type      | Constraints   |
|---------------|-----------|---------------|
| id            | integer   | primary key   |
| patient_name  | varchar   | not null      |
| total_amount  | numeric   | not null      |
| created_at    | timestamp | default now() |

**sale_items**

| Column      | Type    | Constraints              |
|-------------|---------|--------------------------|
| id          | integer | primary key              |
| sale_id     | integer | foreign key → sales.id   |
| medicine_id | integer | foreign key → medicines.id |
| quantity    | integer | not null                 |
| price       | numeric | not null (snapshot price at time of sale) |

### API Contracts

**POST /sale**

- Input: `{ patient_name: str, items: [{ medicine_id: int, quantity: int }] }`
- Process: validate stock → deduct stock → save sale + items (atomic) → calculate total
- Output: `{ message: str, invoice: { ... } }`
- Errors: 422 if stock insufficient; 400 for invalid input

**GET /medicines**

- Returns all medicines; supports `?search=<name>` query parameter
- Output: `[{ id, name, price, stock, company, created_at }]`

**POST /upload-excel**

- Accepts `.xlsx` files only
- Required columns: `name`, `price`, `stock`, `company`
- Processing: validate column presence → validate data types → remove duplicates →
  replace nulls with defaults → bulk insert (upsert by name)

### Business Rules

- `total_amount = Σ (quantity × price)` — computed backend-side
- Stock update on sale: `stock = stock - quantity`
- If `stock < requested_quantity` → reject entire transaction
- Invoice MUST include: pharmacy name, patient name, date, items list, total amount
- Invoice MUST NOT include stock values
- Excel import: accepts `.xlsx` only; duplicate names deduplicated; nulls defaulted

### UI Requirements

**Billing Screen**: patient name input, dynamic medicine rows (medicine + quantity), real-time
display total (UI-computed for UX only), "Generate Slip" button.

**Receipt / Slip** (thermal, 300 px wide, monospace font):
- Header: pharmacy name + details
- Patient info
- Items: `name | qty | price | amount`
- Total & Net Payable
- Footer: "Refund within 7 days"

**Admin Dashboard**: total medicines count, total sales count, remaining stock overview,
add/update medicine forms, low-stock alerts.

## Governance

- This constitution supersedes all other practices, conventions, or verbal agreements.
- Amendments require: (1) a written proposal, (2) version bump per the policy below,
  (3) a migration plan if existing code is affected.
- All PRs MUST pass a Constitution Check before merge (verify compliance with Principles I–VI).
- Complexity violations (deviation from a principle) MUST be justified in writing in the
  relevant `plan.md` Complexity Tracking table.
- Amendments are proposed via `/sp.constitution` and tracked in `history/prompts/constitution/`.
- Significant architectural decisions MUST be captured in ADRs under `history/adr/`.

**Versioning Policy**

- MAJOR: backward-incompatible governance change, principle removal, or redefinition.
- MINOR: new principle or section added; material expansion of existing guidance.
- PATCH: clarifications, wording fixes, non-semantic refinements.

**Version**: 1.0.0 | **Ratified**: 2026-04-14 | **Last Amended**: 2026-04-14
