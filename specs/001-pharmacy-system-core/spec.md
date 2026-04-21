# Feature Specification: Pharmacy Management System — Core

**Feature Branch**: `001-pharmacy-system-core`
**Created**: 2026-04-14
**Status**: Draft
**Input**: Full system specification — inventory, billing, stock management, invoice, Excel import, admin dashboard

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sell Medicines and Generate Invoice (Priority: P1)

A cashier enters a patient name, selects one or more medicines with quantities, and submits the
sale. The system validates stock, deducts it atomically, records the sale, and returns a printable
thermal-style invoice showing medicine names, quantities, prices, the total payable, and a
"Refund within 7 days" footer. Stock values do NOT appear on the invoice.

**Why this priority**: Core revenue-generating action. Every other module exists to support this
operation. Without a working sale flow the system has no value.

**Independent Test**: Create medicines with known stock. Submit a sale via the billing screen.
Verify the invoice is returned, stock is reduced in the database, and one `sales` + correct
`sale_items` records are created. This is fully testable without the dashboard or Excel import.

**Acceptance Scenarios**:

1. **Given** medicines "Panadol" (stock 100, price 50) and "Brufen" (stock 20, price 90) exist,
   **When** a cashier submits a sale for patient "Ali" with Panadol ×2 and Brufen ×1,
   **Then** the system returns an invoice with total 190, Panadol stock becomes 98,
   Brufen stock becomes 19, one `sales` row and two `sale_items` rows are created.

2. **Given** medicine "Panadol" has stock 1,
   **When** a cashier requests quantity 5,
   **Then** the system rejects the sale with a descriptive error ("Insufficient stock for
   Panadol: requested 5, available 1"), no records are written, no stock is changed.

3. **Given** a sale contains multiple medicines where one has insufficient stock,
   **When** the sale is submitted,
   **Then** the entire transaction rolls back — no partial stock deductions or partial records.

4. **Given** the sale is successfully processed,
   **When** the cashier clicks Print,
   **Then** the slip renders at 300 px wide in monospace font showing: pharmacy header, date,
   patient name, itemised table (name | qty | price | amount), total, and footer — with no
   stock values visible.

---

### User Story 2 — Manage Medicine Inventory (Priority: P2)

A pharmacist adds new medicines, updates prices or stock levels, and searches the medicine list
to find specific items.

**Why this priority**: Inventory data must exist before any sale or import can succeed.
Administrators need a UI to correct prices and restock manually.

**Independent Test**: Use the admin UI (or API directly) to add a medicine, then retrieve it
via search. Update its price and verify the updated value is returned. Testable without the
billing flow.

**Acceptance Scenarios**:

1. **Given** no medicine named "Calpol" exists,
   **When** an admin submits name "Calpol", price 30, stock 50, company "GSK",
   **Then** the medicine is saved and appears in the medicines list.

2. **Given** "Calpol" already exists,
   **When** an admin tries to add another medicine with name "Calpol",
   **Then** the system rejects the request with a unique-name error.

3. **Given** medicine "Panadol" exists with price 50,
   **When** an admin updates price to 60,
   **Then** subsequent GET /medicines returns Panadol with price 60.

4. **Given** the medicines list contains 50 items,
   **When** a user searches for "pan",
   **Then** only medicines whose names contain "pan" (case-insensitive) are returned.

5. **Given** price is submitted as −10 or stock as −5,
   **When** the request reaches the backend,
   **Then** a validation error is returned; no record is created or modified.

---

### User Story 3 — Bulk Import Medicines via Excel (Priority: P3)

A pharmacist uploads an `.xlsx` file to load many medicines at once. The system validates
columns, cleans duplicates and nulls, and inserts valid rows in bulk.

**Why this priority**: Saves significant manual entry time when onboarding initial inventory.
Not blocking for daily operations; cashiers can still sell with manually entered data.

**Independent Test**: Upload a valid `.xlsx` with 10 rows (including 2 duplicates and 1 null
company). Verify 8 unique medicines are inserted, no duplicates exist, and nulls are defaulted.
Testable without billing or dashboard.

**Acceptance Scenarios**:

1. **Given** an `.xlsx` file with columns name, price, stock, company and 10 valid rows,
   **When** uploaded via the admin UI,
   **Then** all 10 medicines appear in the database.

2. **Given** an `.xlsx` with duplicate name entries,
   **When** uploaded,
   **Then** only the first occurrence of each name is inserted; subsequent duplicates are
   silently skipped.

3. **Given** an `.xlsx` where some company cells are null/empty,
   **When** uploaded,
   **Then** those rows are inserted with a default value for company (e.g., empty string or
   "Unknown").

4. **Given** an `.xlsx` missing the required "price" column,
   **When** uploaded,
   **Then** the system returns a clear validation error listing the missing columns; no data is
   inserted.

5. **Given** a non-`.xlsx` file (e.g., `.csv`) is uploaded,
   **When** the request is received,
   **Then** the system rejects it with an unsupported file type error.

6. **Given** the import file contains a medicine name that already exists in the database,
   **When** uploaded,
   **Then** the existing record is NOT overwritten; the duplicate row is skipped.

---

### User Story 4 — Admin Dashboard Overview (Priority: P4)

An admin opens the dashboard to see aggregate pharmacy metrics: total distinct medicines,
total number of sales, and total remaining stock units across all medicines. Low-stock items
are highlighted for attention.

**Why this priority**: Operational visibility. Valuable but not blocking sales or imports.

**Independent Test**: Insert known data (10 medicines, 3 sales, total stock 500 units).
Open the dashboard and verify the three counters match. Testable independently of billing UI.

**Acceptance Scenarios**:

1. **Given** the database has 10 medicines and 3 completed sales,
   **When** an admin opens the dashboard,
   **Then** the dashboard shows: "10 Medicines", "3 Sales", and the correct total remaining
   stock.

2. **Given** a medicine has stock ≤ 10 (low-stock threshold),
   **When** the admin views the dashboard,
   **Then** that medicine is flagged with a low-stock visual alert.

---

### Edge Cases

- What happens when a sale request includes `quantity = 0`?
  → The backend MUST reject with a validation error (quantity must be ≥ 1).
- What happens if the database connection fails mid-transaction?
  → The transaction rolls back; the API returns a 500 error; no partial writes persist.
- What if the same medicine appears twice in one sale's items array?
  → Backend must sum quantities and validate combined total against stock, or reject as
  duplicate item in payload — behaviour MUST be consistent and documented.
- What if an Excel file has 0 valid rows after deduplication?
  → Return a clear message: "No valid records to import."

---

## Requirements *(mandatory)*

### Functional Requirements

**Inventory**

- **FR-001**: System MUST allow creation of a medicine with name, price, stock, and optional company.
- **FR-002**: System MUST reject medicine creation if name already exists (case-insensitive uniqueness MUST be validated at the database level).
- **FR-003**: System MUST allow updating a medicine's price and/or stock.
- **FR-004**: System MUST return all medicines; MUST support filtering by partial name match (case-insensitive).
- **FR-005**: System MUST reject price < 0 and stock < 0 with a validation error.

**Billing & Sales**

- **FR-006**: System MUST create a sale given a patient name and one or more medicine–quantity pairs.
- **FR-007**: System MUST validate that sufficient stock exists for every line item before committing any writes.
- **FR-008**: System MUST deduct stock and persist the sale atomically; partial writes are forbidden.
- **FR-009**: System MUST calculate total as `Σ (quantity × price_at_sale_time)` on the backend.
- **FR-010**: System MUST return an invoice payload on successful sale containing: sale ID, total amount, and per-item breakdown (name, quantity, price, line total).
- **FR-011**: Invoice MUST NOT include stock values.
- **FR-012**: System MUST reject any sale item with quantity < 1.

**Invoice / Slip UI**

- **FR-013**: Frontend MUST render a printable slip at 300 px width using monospace font.
- **FR-014**: Slip MUST include: pharmacy name (static), date, patient name, itemised table, net payable total, and "Refund within 7 days" footer.

**Excel Import**

- **FR-015**: System MUST accept `.xlsx` files only; other formats MUST be rejected.
- **FR-016**: System MUST validate presence of columns: name, price, stock, company.
- **FR-017**: System MUST deduplicate rows by medicine name (first occurrence wins) before inserting.
- **FR-018**: System MUST replace null values with safe defaults (company → empty string or "Unknown"; nulls in price/stock → reject row with error).
- **FR-019**: Import MUST NOT overwrite existing medicines that share the same name.

**Admin Dashboard**

- **FR-020**: System MUST expose an endpoint returning: total medicine count, total sales count, total remaining stock.
- **FR-021**: Dashboard UI MUST visually alert medicines with stock at or below the low-stock threshold (default: 10 units).

**Error Handling**

- **FR-022**: System MUST return HTTP 400 with a descriptive message when stock is insufficient, naming the specific medicine(s) and values involved.
- **FR-023**: System MUST return HTTP 422 for invalid input (missing fields, wrong types, constraint violations).
- **FR-024**: All backend errors MUST be logged with endpoint, input context, and error detail.

### Key Entities

- **Medicine**: Represents a pharmaceutical product. Attributes: id, name (unique), price, stock, company, created_at. Central entity linking inventory and sales.
- **Sale**: Represents a completed transaction. Attributes: id, patient_name, total_amount, created_at. One sale per billing event.
- **SaleItem**: Represents a line item within a sale. Attributes: id, sale_id, medicine_id, quantity, price (snapshot at time of sale). Many per sale; links back to Medicine.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cashier can complete a full sale — from patient name entry to printed invoice — in under 60 seconds for a basket of up to 10 medicines.
- **SC-002**: Stock levels are updated immediately and accurately after every sale with zero tolerance for negative stock values.
- **SC-003**: Every completed sale is retrievable with full item detail and matches the invoice shown to the patient.
- **SC-004**: An Excel file with up to 500 medicines can be imported and validated in under 30 seconds with a clear success/failure report.
- **SC-005**: Invalid sale attempts (insufficient stock, missing fields, invalid quantities) are rejected 100% of the time with a human-readable error message before any data is written.
- **SC-006**: The admin dashboard reflects current inventory and sales counts within 5 seconds of any update.
- **SC-007**: The system handles at least 10 concurrent sale submissions without data corruption or stock inconsistency.

---

## Assumptions

- **A-001**: Pharmacy name displayed on the invoice is a static configuration value (environment variable or config file); no UI is required to change it.
- **A-002**: Low-stock threshold is fixed at ≤ 10 units for the initial release; it is not configurable via UI.
- **A-003**: No authentication or user roles are required for this release; all endpoints are accessible to anyone with network access. (Multi-user auth is a future enhancement per constitution §14.)
- **A-004**: The price recorded in `sale_items` is the medicine's price at the moment of sale, not recalculated retroactively if the price changes later.
- **A-005**: The system operates in a single currency; no currency conversion or multi-currency support is required.
- **A-006**: Excel import is a one-time or occasional operation, not a real-time data feed.
