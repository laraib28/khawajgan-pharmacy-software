---
id: "001"
title: "Pharmacy Management System Constitution — Initial"
stage: constitution
date: 2026-04-14
surface: agent
model: claude-sonnet-4-6
feature: none
branch: master
user: unknown
command: /sp.constitution
labels: ["constitution","pharmacy","inventory","billing","fastapi","nextjs","postgresql"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - .specify/memory/constitution.md
tests:
  - null
---

## Prompt

# 🏥 Pharmacy Management System - Constitution (Production Ready)

## 1. Purpose

This system manages pharmacy inventory, billing, and sales tracking.
It ensures accurate stock handling, reliable billing, and printable receipts for customers.

---

## 2. Tech Stack

* Frontend: Next.js
* Backend: FastAPI (Python)
* Database: PostgreSQL (Neon)
* Deployment:

  * Backend: DigitalOcean Droplet (Ubuntu + NGINX + Gunicorn)
  * Frontend: DigitalOcean App Platform

---

## 3. Core Principles

### 3.1 Source of Truth

* All stock data MUST exist only in the database.
* Frontend must NEVER store or calculate stock.

### 3.2 Backend Authority

* All calculations MUST be performed in backend:

  * total amount
  * price calculations
  * stock deduction
* Frontend is strictly for UI and interaction.

### 3.3 Data Integrity

* Stock must NEVER go below zero.
* Every sale must be recorded with items.
* Medicine names must be unique.

---

## 4. Data Models

### 4.1 Medicines

* id (primary key)
* name (unique, required)
* price (required)
* stock (required)
* company (optional)
* created_at

### 4.2 Sales

* id (primary key)
* patient_name (required)
* total_amount (required)
* created_at

### 4.3 Sale Items

* id (primary key)
* sale_id (foreign key)
* medicine_id (foreign key)
* quantity (required)
* price (required)

---

## 5. Business Rules

### 5.1 Inventory Rules

* Stock is updated ONLY via backend.
* On every sale:
  stock = stock - quantity
* If stock < requested quantity:
  → reject transaction with error

### 5.2 Billing Rules

* Total = sum(quantity × price)
* Invoice must include:

  * Pharmacy name
  * Patient name
  * Date
  * Items list
  * Total amount
* Invoice must NOT include stock

### 5.3 Sales Rules

* Each sale must:

  * create 1 record in sales table
  * create multiple records in sale_items table
* All operations must be atomic (transaction-based)

---

## 6. API Contracts

### POST /sale

Input:

* patient_name
* items: [{ medicine_id, quantity }]

Process:

* Validate stock
* Deduct stock
* Save sale and items
* Calculate total

Output:

* success message
* invoice data

---

### GET /medicines

* Return all medicines
* Support search by name

---

### POST /upload-excel

* Upload Excel file
* Required columns:

  * name
  * price
  * stock
  * company
* Remove duplicates
* Validate data types
* Insert into database

---

## 7. UI Requirements

### 7.1 Billing Screen

* Input patient name
* Add medicines dynamically
* Enter quantity
* Show real-time total (UI only, backend verified)
* Button: Generate Slip

---

### 7.2 Receipt (Slip)

* Width: 300px (thermal style)
* Font: monospace
* Layout:

  * Header (pharmacy name + details)
  * Patient info
  * Items list:
    name | qty | price | amount
  * Total & Net Payable
  * Footer message: "Refund within 7 days"

---

### 7.3 Admin Dashboard

* Show:

  * Total medicines
  * Total sales
  * Remaining stock
* Features:

  * Add/update medicines
  * Low stock alerts

---

## 8. Excel Import Rules

* Accept .xlsx files only
* Validate required columns
* Remove duplicate medicine names
* Replace null values with defaults
* Bulk insert using optimized queries

---

## 9. Error Handling

* Reject sale if stock insufficient
* Validate all inputs before processing
* Return clear error messages
* Log backend errors

---

## 10. Security Rules

* No direct database access from frontend
* All operations via backend APIs
* Validate and sanitize all inputs
* Protect API endpoints

---

## 11. Deployment Rules (NO DOCKER)

### Backend (DigitalOcean Droplet)

* OS: Ubuntu
* Server: Gunicorn + Uvicorn workers
* Reverse Proxy: NGINX
* Run as background service

### Frontend

* Deploy via DigitalOcean App Platform
* Connect GitHub repository

### Environment Variables

* DATABASE_URL (Neon)
* API base URL

---

## 12. Architecture Rules

* Follow clean architecture
* Separate modules:

  * Inventory service
  * Billing service
* Use database transactions for sales operations

---

## 13. Non-Negotiable Rules

* Stock is NEVER handled on frontend
* Backend is ALWAYS the source of truth
* Every sale MUST update stock immediately
* Invoice MUST NOT include stock
* All critical operations MUST be transactional

---

## 14. Future Enhancements

* Barcode scanning
* Expiry tracking
* Multi-user authentication (admin/cashier)
* Sales analytics dashboard

## Response snapshot

Constitution v1.0.0 written to `.specify/memory/constitution.md`. Six core principles defined
(Backend Authority, Data Integrity, Clean Architecture, API-First Security, Transactional
Consistency, Observability & Error Handling). Full tech stack, data models, API contracts, UI
requirements, deployment rules, and governance section populated. No template placeholders remain.

## Outcome

- ✅ Impact: Project constitution established from v0.0.0 (template) to v1.0.0; all governance principles recorded.
- 🧪 Tests: No tests applicable at constitution stage.
- 📁 Files: .specify/memory/constitution.md (written), history/prompts/constitution/001-pharmacy-constitution-initial.constitution.prompt.md (this file)
- 🔁 Next prompts: /sp.specify <feature> to create the first feature spec; /sp.adr if any architecture decisions need formal recording.
- 🧠 Reflection: Constitution derived cleanly from user input; all 14 sections mapped to 6 principles + 3 additional sections. No ambiguity required escalation.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): N/A — constitution stage, no automated graders
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Consider adding expiry-tracking principle when that future enhancement is prioritised
