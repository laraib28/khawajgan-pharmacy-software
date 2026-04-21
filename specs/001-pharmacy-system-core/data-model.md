# Data Model: Pharmacy Management System — Core

**Branch**: `001-pharmacy-system-core` | **Date**: 2026-04-14

---

## Entity Overview

```
medicines ──< sale_items >── sales
```

- `medicines` → `sale_items`: one-to-many (a medicine appears in many sale lines)
- `sales` → `sale_items`: one-to-many (a sale has many line items)

---

## Table: `medicines`

**Purpose**: Single source of truth for pharmaceutical product catalogue and live stock levels.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-increment |
| name | VARCHAR(255) | NOT NULL, UNIQUE | Case-insensitive uniqueness enforced via CITEXT or `LOWER(name)` unique index |
| price | NUMERIC(10,2) | NOT NULL, CHECK (price >= 0) | Price in local currency |
| stock | INTEGER | NOT NULL, CHECK (stock >= 0) | Current available units |
| company | VARCHAR(255) | NULLABLE | Manufacturer/supplier name |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |

**Indexes**:
- `idx_medicines_name_lower` — `LOWER(name)` for case-insensitive search
- Unique constraint on `LOWER(name)` to prevent case-variant duplicates

**SQLAlchemy model**:
```python
class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    price = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, nullable=False)
    company = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sale_items = relationship("SaleItem", back_populates="medicine")
```

**Validation rules** (enforced in InventoryService + DB):
- `name`: required, unique (case-insensitive), 1–255 chars
- `price`: ≥ 0, required
- `stock`: ≥ 0, integer, required
- `company`: optional; defaults to empty string on Excel import

---

## Table: `sales`

**Purpose**: Represents a completed billing transaction. One record per cashier submission.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-increment |
| patient_name | VARCHAR(255) | NOT NULL | Customer name as entered |
| total_amount | NUMERIC(10,2) | NOT NULL | Backend-calculated total = Σ(qty × price) |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Sale timestamp (used on invoice) |

**SQLAlchemy model**:
```python
class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True)
    patient_name = Column(String(255), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("SaleItem", back_populates="sale")
```

**Validation rules**:
- `patient_name`: required, 1–255 chars
- `total_amount`: computed by backend; never accepted from client

---

## Table: `sale_items`

**Purpose**: Line items for a sale. Records the price at the time of sale (price snapshot) so
historical invoices remain accurate even if the medicine's price later changes.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | SERIAL | PRIMARY KEY | Auto-increment |
| sale_id | INTEGER | NOT NULL, FK → sales.id ON DELETE CASCADE | Parent sale |
| medicine_id | INTEGER | NOT NULL, FK → medicines.id | Source medicine |
| quantity | INTEGER | NOT NULL, CHECK (quantity >= 1) | Units sold |
| price | NUMERIC(10,2) | NOT NULL | Price snapshot at sale time |

**SQLAlchemy model**:
```python
class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(Numeric(10, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    medicine = relationship("Medicine", back_populates="sale_items")
```

**Validation rules**:
- `quantity`: ≥ 1 (per FR-012)
- `price`: copied from `medicine.price` at transaction time; never from client
- `medicine_id`: must reference an existing medicine; otherwise 422

---

## Alembic Migration Plan

```
alembic/versions/
├── 001_create_medicines.py
├── 002_create_sales.py
└── 003_create_sale_items.py
```

**Migration 001** — `create_medicines`:
```python
op.create_table('medicines',
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('name', sa.String(255), nullable=False),
    sa.Column('price', sa.Numeric(10,2), nullable=False),
    sa.Column('stock', sa.Integer(), nullable=False),
    sa.Column('company', sa.String(255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
)
op.create_index('idx_medicines_name_lower', 'medicines',
    [sa.text('LOWER(name)')], unique=True)
op.create_check_constraint('ck_medicines_price', 'medicines', 'price >= 0')
op.create_check_constraint('ck_medicines_stock', 'medicines', 'stock >= 0')
```

**Migration 002** — `create_sales`:
```python
op.create_table('sales',
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('patient_name', sa.String(255), nullable=False),
    sa.Column('total_amount', sa.Numeric(10,2), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
)
```

**Migration 003** — `create_sale_items`:
```python
op.create_table('sale_items',
    sa.Column('id', sa.Integer(), primary_key=True),
    sa.Column('sale_id', sa.Integer(), sa.ForeignKey('sales.id', ondelete='CASCADE'), nullable=False),
    sa.Column('medicine_id', sa.Integer(), sa.ForeignKey('medicines.id'), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('price', sa.Numeric(10,2), nullable=False),
)
op.create_check_constraint('ck_sale_items_quantity', 'sale_items', 'quantity >= 1')
```

---

## State Transitions

### Medicine Stock

```
Initial stock (N)
    │
    ├──[Manual update via PUT /medicines/{id}]──→ New stock value (validated ≥ 0)
    │
    └──[Sale via POST /sale]──→ stock - quantity  (must not go below 0; reject if would)
```

### Sale Lifecycle

```
POST /sale received
    │
    ├── [Stock validation fails for any item] ──→ ROLLBACK → 400 error returned
    │
    └── [All items valid]
            │
            ├── Deduct stock for each item
            ├── INSERT sales row
            ├── INSERT sale_items rows
            ├── COMMIT
            └── Return invoice payload → 200 OK
```

---

## Pydantic Schemas

### Medicine

```python
class MedicineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)
    stock: int = Field(..., ge=0)
    company: Optional[str] = None

class MedicineUpdate(BaseModel):
    price: Optional[Decimal] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)

class MedicineOut(BaseModel):
    id: int
    name: str
    price: Decimal
    stock: int
    company: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
```

### Sale

```python
class SaleItemInput(BaseModel):
    medicine_id: int
    quantity: int = Field(..., ge=1)

class SaleCreate(BaseModel):
    patient_name: str = Field(..., min_length=1)
    items: List[SaleItemInput] = Field(..., min_length=1)

class InvoiceItem(BaseModel):
    name: str
    quantity: int
    price: Decimal
    amount: Decimal   # quantity × price

class InvoiceOut(BaseModel):
    sale_id: int
    patient_name: str
    created_at: datetime
    items: List[InvoiceItem]
    total_amount: Decimal
```

### Dashboard

```python
class DashboardStats(BaseModel):
    total_medicines: int
    total_sales: int
    total_stock: int          # sum of all medicines.stock
    low_stock_medicines: List[MedicineOut]   # stock <= 10
```
