# Quickstart: Pharmacy Management System — Core

**Branch**: `001-pharmacy-system-core` | **Date**: 2026-04-14

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- A Neon PostgreSQL database (free tier works)
- Git

---

## 1. Clone & Environment Setup

```bash
git clone <repo-url>
cd pharmacy-software-khawajgan
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname?ssl=require
PHARMACY_NAME=Khawajgan Pharmacy
FRONTEND_ORIGIN=http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 2. Database Setup

```bash
# From backend/ directory, with venv active
alembic upgrade head
```

Verify: connect to Neon and check that `medicines`, `sales`, `sale_items` tables exist.

---

## 3. Run Development Servers

### Backend (terminal 1)

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

Verify: `http://localhost:8000/health` → `{"status": "ok"}`
API docs: `http://localhost:8000/docs`

### Frontend (terminal 2)

```bash
cd frontend
npm run dev
```

Verify: `http://localhost:3000` — dashboard loads.

---

## 4. Smoke Tests (Manual)

### Add a medicine

```bash
curl -X POST http://localhost:8000/medicines \
  -H "Content-Type: application/json" \
  -d '{"name": "Panadol", "price": 50, "stock": 100, "company": "GSK"}'
# Expected: 201 with medicine object
```

### List medicines

```bash
curl http://localhost:8000/medicines
# Expected: array with Panadol
```

### Create a sale

```bash
# Get medicine id from previous response (e.g., 1)
curl -X POST http://localhost:8000/sale \
  -H "Content-Type: application/json" \
  -d '{"patient_name": "Ali", "items": [{"medicine_id": 1, "quantity": 2}]}'
# Expected: invoice with total_amount 100, Panadol stock → 98
```

### Insufficient stock test

```bash
curl -X POST http://localhost:8000/sale \
  -H "Content-Type: application/json" \
  -d '{"patient_name": "Test", "items": [{"medicine_id": 1, "quantity": 9999}]}'
# Expected: 400 with message "Insufficient stock for Panadol: requested 9999, available 98"
```

### Dashboard stats

```bash
curl http://localhost:8000/dashboard/stats
# Expected: {"total_medicines": 1, "total_sales": 1, "total_stock": 98, "low_stock_medicines": []}
```

---

## 5. Excel Import Test

1. Create a test file `test_medicines.xlsx` with columns: `name`, `price`, `stock`, `company`
2. Add 5–10 rows (include 1–2 duplicates)
3. Upload via admin UI at `http://localhost:3000/import` or via curl:

```bash
curl -X POST http://localhost:8000/upload-excel \
  -F "file=@test_medicines.xlsx"
# Expected: {"inserted": N, "skipped": M, "errors": []}
```

---

## 6. Production Deployment Checklist

### Backend (DigitalOcean Droplet)

```bash
# On the droplet (Ubuntu 22.04)
sudo apt update && sudo apt install python3.11 python3-pip nginx -y
git clone <repo-url> && cd pharmacy-software-khawajgan/backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in production values

# Alembic
alembic upgrade head

# Systemd service
sudo cp deploy/pharmacy-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pharmacy-backend
sudo systemctl start pharmacy-backend

# NGINX
sudo cp deploy/nginx.conf /etc/nginx/sites-available/pharmacy
sudo ln -s /etc/nginx/sites-available/pharmacy /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Frontend (DigitalOcean App Platform)

1. Connect GitHub repository via App Platform dashboard
2. Set build command: `cd frontend && npm run build`
3. Set run command: `cd frontend && npm run start`
4. Add environment variable: `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com`
5. Deploy

---

## 7. Validation Checklist

- [ ] `GET /health` returns 200
- [ ] `POST /medicines` creates a medicine; duplicate name returns 400
- [ ] `GET /medicines?search=pan` returns only matching medicines
- [ ] `POST /sale` with valid stock → deducts stock, returns invoice, no stock on invoice
- [ ] `POST /sale` with insufficient stock → 400, no writes
- [ ] `POST /upload-excel` with valid .xlsx → inserts medicines, skips duplicates
- [ ] `GET /dashboard/stats` returns correct counts
- [ ] Slip prints at 300 px, monospace, no stock values
- [ ] Low-stock medicines (stock ≤ 10) flagged in dashboard
