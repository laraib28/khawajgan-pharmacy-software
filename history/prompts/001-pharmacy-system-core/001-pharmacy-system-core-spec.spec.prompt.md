---
id: "001"
title: "Pharmacy System Core — Full Spec"
stage: spec
date: 2026-04-14
surface: agent
model: claude-sonnet-4-6
feature: 001-pharmacy-system-core
branch: 001-pharmacy-system-core
user: unknown
command: /sp.specify
labels: ["spec","pharmacy","inventory","billing","excel-import","dashboard","fastapi","nextjs"]
links:
  spec: specs/001-pharmacy-system-core/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-pharmacy-system-core/spec.md
  - specs/001-pharmacy-system-core/checklists/requirements.md
  - history/prompts/001-pharmacy-system-core/001-pharmacy-system-core-spec.spec.prompt.md
tests:
  - null
---

## Prompt

# 🏥 Pharmacy Management System

## Detailed Specification (Based on Constitution)

---

# 1. System Overview

The system provides:

* Medicine inventory management
* Billing and invoice generation
* Stock tracking with automatic deduction
* Sales history tracking
* Excel-based bulk import

The system must follow strict backend-controlled logic.

---

# 2. System Architecture

Frontend (Next.js) communicates with Backend (FastAPI) via REST APIs.
Backend interacts with PostgreSQL (Neon database).

Flow:

* User action → API request → Backend logic → Database update → Response → UI update

---

# 3. Module Specifications

---

## 3.1 Inventory Module

### Features:

* Add new medicine
* Update existing medicine
* View medicines list
* Search medicines

### API Details:

#### POST /medicines

Input:

* name (string)
* price (number)
* stock (integer)
* company (string)

Validation:

* name must be unique
* price > 0
* stock ≥ 0

---

#### GET /medicines

* Return all medicines
* Support query param: ?search=

---

#### PUT /medicines/{id}

* Update price and/or stock
* Validate values

---

## 3.2 Billing Module

### Features:

* Enter patient name
* Select medicines
* Input quantities
* Calculate total
* Generate invoice

---

### API: POST /sale

#### Input:

```json
{
  "patient_name": "Ali",
  "items": [
    { "medicine_id": 1, "quantity": 2 }
  ]
}
```

### Processing Logic:

1. Start database transaction
2. For each item: Fetch medicine, Validate stock
3. If any item invalid → rollback
4. Deduct stock
5. Create sale record
6. Create sale_items records
7. Calculate total
8. Commit transaction

---

## 3.3 Stock Management

* Stock stored in medicines table
* Updated ONLY during sale or manual update
* Never calculated in frontend

---

## 3.4 Invoice (Slip)

* Width: 300px, monospace, printable
* Header, date, patient name, items table, total, footer
* Do NOT include stock

---

## 3.5 Excel Import Module

### API: POST /upload-excel

1. Receive file (.xlsx)
2. Validate columns: name, price, stock, company
3. Clean data: remove duplicates, fill null values
4. Insert into database

---

## 3.6 Admin Dashboard

* Total medicines count
* Total sales amount
* Remaining stock (sum)
* GET /dashboard/stats

---

## 3.7 Error Handling

* Insufficient stock → 400 error
* Invalid input → validation error
* DB failure → rollback

---

## 3.8 Security

* Validate all inputs
* No direct DB access from frontend
* Backend APIs only

---

## 4. Database Behavior

* sales → sale_items (1-to-many)
* medicines → sale_items (1-to-many)
* medicine.name → UNIQUE
* stock ≥ 0

---

## 5. Deployment Specification

* Backend: Gunicorn + Uvicorn + NGINX on DigitalOcean Droplet
* Frontend: DigitalOcean App Platform
* Env vars: DATABASE_URL, API_BASE_URL

---

## Response snapshot

Spec written to `specs/001-pharmacy-system-core/spec.md`. Branch `001-pharmacy-system-core`
created. Four prioritised user stories defined (P1: Billing/Sale, P2: Inventory CRUD,
P3: Excel Import, P4: Admin Dashboard). 24 functional requirements, 7 success criteria,
6 assumptions, and comprehensive edge cases documented. Quality checklist: all items pass.
No [NEEDS CLARIFICATION] markers needed — all gaps resolved via reasonable assumptions.

## Outcome

- ✅ Impact: Full system specification created; all 4 modules covered with testable acceptance scenarios.
- 🧪 Tests: No tests at spec stage; acceptance scenarios defined for each user story.
- 📁 Files: specs/001-pharmacy-system-core/spec.md, specs/001-pharmacy-system-core/checklists/requirements.md
- 🔁 Next prompts: /sp.clarify to refine ambiguities, or /sp.plan to generate architecture plan.
- 🧠 Reflection: Detailed user input mapped cleanly to spec template. No clarifications required; all gaps filled with documented assumptions aligned to constitution.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): N/A — spec stage
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Consider splitting into sub-feature specs (inventory-only, billing-only) if planning phase reveals scope is too large for one iteration.
