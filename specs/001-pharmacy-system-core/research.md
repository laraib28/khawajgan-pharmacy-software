# Research: Pharmacy Management System — Core

**Branch**: `001-pharmacy-system-core` | **Date**: 2026-04-14
**Phase**: 0 — Pre-design research

---

## Decision 1: Python ORM Strategy

**Decision**: SQLAlchemy 2.x with async session (via `asyncpg` driver)

**Rationale**:
- SQLAlchemy 2.x provides a first-class async API (`AsyncSession`, `async_scoped_session`)
  that integrates cleanly with FastAPI's async request handling.
- Alembic (SQLAlchemy's migration tool) is the de-facto standard for schema versioning in
  Python; no competing tool provides comparable maturity.
- asyncpg is the fastest PostgreSQL driver for Python (benchmarked 3–5× faster than psycopg2
  for async workloads).

**Alternatives considered**:
- **Tortoise ORM**: Django-inspired async ORM; smaller ecosystem, fewer production examples.
- **raw asyncpg**: Maximum performance; too much boilerplate for CRUD-heavy operations.
- **SQLModel**: FastAPI author's library layering Pydantic on SQLAlchemy; less mature, still
  in active API churn as of 2025.

**Connection string pattern for Neon**:
```
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?ssl=require
```

---

## Decision 2: Database Migration Tool

**Decision**: Alembic with async engine support

**Rationale**:
- Standard companion to SQLAlchemy; migration files are pure Python with upgrade/downgrade
  functions — reviewable and version-controlled.
- Supports async engines via `run_sync()` wrapper in `env.py`.

**Migration pattern**:
```python
# alembic/env.py
from app.database import engine
def run_migrations_online():
    connectable = engine.sync_engine
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)
        with context.begin_transaction():
            context.run_migrations()
```

---

## Decision 3: Excel Processing

**Decision**: `pandas` + `openpyxl` engine

**Rationale**:
- `pandas.read_excel(..., engine='openpyxl')` reads `.xlsx` natively.
- DataFrame operations (`.drop_duplicates()`, `.fillna()`, column presence check) are concise
  and well-tested for data cleaning use cases.
- openpyxl is the only pure-Python .xlsx reader that handles modern Excel formats safely.

**Key pandas operations**:
```python
df = pd.read_excel(file, engine='openpyxl')
required = {'name', 'price', 'stock', 'company'}
if not required.issubset(df.columns):
    raise ValueError(f"Missing columns: {required - set(df.columns)}")
df = df.drop_duplicates(subset=['name'], keep='first')
df['company'] = df['company'].fillna('')
# Reject rows where price or stock are null
df = df.dropna(subset=['price', 'stock'])
```

**Alternatives considered**:
- **openpyxl direct**: More control; significantly more verbose for DataFrame-style operations.
- **xlrd**: Does not support `.xlsx` (only `.xls`); not suitable.

---

## Decision 4: Frontend State Management

**Decision**: React built-in state (`useState` / `useReducer`) only

**Rationale**:
- Application has 4 screens; data does not need to be shared across distant component trees.
- `useReducer` is sufficient for the billing form's dynamic medicine rows list.
- No global server state caching requirement (dashboard is refreshed on page load; medicines
  list is fetched per-use).
- Adding Redux, Zustand, or React Query introduces unnecessary complexity at this scale.

**Billing form state shape**:
```typescript
type LineItem = { medicineId: number; medicineName: string; quantity: number; price: number }
type BillingState = { patientName: string; items: LineItem[]; displayTotal: number }
```

---

## Decision 5: Print / Slip Implementation

**Decision**: CSS `@media print` + `window.print()` — no external library

**Rationale**:
- The slip has a fixed 300 px layout; CSS print rules can hide navigation and constrain width.
- No PDF generation needed (per spec: printable slip, not a downloadable PDF).
- Browser print dialog gives the cashier paper-vs-PDF choice without backend involvement.

**CSS pattern**:
```css
@media print {
  nav, .no-print { display: none !important; }
  .slip { width: 300px; font-family: monospace; margin: 0 auto; }
}
```

---

## Decision 6: CORS Configuration

**Decision**: FastAPI `CORSMiddleware` with explicit origin allowlist

**Rationale**:
- Frontend (DigitalOcean App Platform) and backend (Droplet) are on different origins.
- Allowlist should include the App Platform domain; wildcard `*` is not appropriate for a
  production pharmacy system (even without auth, it reduces surface for future auth addition).

**Pattern**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Decision 7: Concurrent Sale Safety

**Decision**: Database-level row locking with `SELECT ... FOR UPDATE`

**Rationale**:
- With 10+ concurrent cashiers, two simultaneous sales for the same medicine could both pass
  the stock check if done with simple reads, then both deduct — resulting in negative stock.
- `SELECT ... FOR UPDATE` within the transaction locks the medicine row; the second transaction
  waits until the first commits, then re-reads the updated stock.

**SQLAlchemy pattern**:
```python
result = await session.execute(
    select(Medicine).where(Medicine.id == item.medicine_id).with_for_update()
)
medicine = result.scalar_one_or_none()
```

This satisfies **SC-007** (10 concurrent submissions without stock inconsistency).

---

## Decision 8: Deployment Process Manager

**Decision**: Gunicorn with UvicornWorker class (no Docker)

**Rationale**:
- Constitution §11 mandates no Docker.
- Gunicorn is the standard WSGI/ASGI process manager for Python on Ubuntu.
- `UvicornWorker` wraps the async event loop per worker.
- 4 workers recommended for a low-traffic pharmacy system.

**Systemd service template**:
```ini
[Unit]
Description=Pharmacy Backend API
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/pharmacy-backend
ExecStart=/home/ubuntu/.venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 app.main:app
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Summary of Resolved Unknowns

| Unknown | Resolution |
|---|---|
| Async ORM choice | SQLAlchemy 2.x + asyncpg |
| Migration tool | Alembic |
| Excel library | pandas + openpyxl |
| Frontend state | React useState/useReducer |
| Print mechanism | CSS @media print + window.print() |
| CORS | CORSMiddleware with env-configured origin |
| Concurrent stock safety | SELECT FOR UPDATE row locking |
| Process manager | Gunicorn + UvicornWorker, systemd |
