---
id: "002"
title: "Pharmacy System Core — Implementation Plan"
stage: plan
date: 2026-04-14
surface: agent
model: claude-sonnet-4-6
feature: 001-pharmacy-system-core
branch: 001-pharmacy-system-core
user: unknown
command: /sp.plan
labels: ["plan","pharmacy","fastapi","nextjs","sqlalchemy","alembic","pandas","postgresql","neon","digitalocean"]
links:
  spec: specs/001-pharmacy-system-core/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-pharmacy-system-core/plan.md
  - specs/001-pharmacy-system-core/research.md
  - specs/001-pharmacy-system-core/data-model.md
  - specs/001-pharmacy-system-core/quickstart.md
  - specs/001-pharmacy-system-core/contracts/medicines.md
  - specs/001-pharmacy-system-core/contracts/sales.md
  - specs/001-pharmacy-system-core/contracts/excel-import.md
  - specs/001-pharmacy-system-core/contracts/dashboard.md
  - CLAUDE.md
tests:
  - null
---

## Prompt

# 🏥 Pharmacy Management System

## Development Plan

[9-phase development plan covering: Project Setup, Database & Models, Inventory System,
Billing System (CORE), Slip Generation, Excel Import, Admin Dashboard, Deployment,
Testing & Optimization. Backend-first strategy with FastAPI, Next.js frontend, PostgreSQL
on Neon, DigitalOcean deployment without Docker.]

## Response snapshot

Implementation plan generated with all Phase 0 (research) and Phase 1 (design) artifacts.

**Constitution Check**: All 11 gates PASS — no violations.

**Architecture decisions resolved**:
- ORM: SQLAlchemy 2.x async + asyncpg (vs Tortoise ORM, raw asyncpg)
- Migrations: Alembic
- Excel: pandas + openpyxl
- Frontend state: React useState/useReducer (no Redux/Zustand)
- Print: CSS @media print + window.print() — no library
- CORS: CORSMiddleware with env-configured origin allowlist
- Concurrent safety: SELECT FOR UPDATE row-locking per sale
- Process manager: Gunicorn + UvicornWorker + systemd

**Artifacts created**:
- plan.md: 9-phase implementation plan with source tree (backend/ + frontend/)
- research.md: 8 architectural decisions with rationale and alternatives
- data-model.md: 3-table schema, migrations, SQLAlchemy models, Pydantic schemas, state transitions
- quickstart.md: local setup, smoke tests, deployment checklist
- contracts/medicines.md, contracts/sales.md, contracts/excel-import.md, contracts/dashboard.md
- CLAUDE.md: agent context updated with tech stack, project structure, commands, code style

## Outcome

- ✅ Impact: Full implementation plan ready; all design artifacts generated; CLAUDE.md updated.
- 🧪 Tests: No tests at plan stage; acceptance criteria and smoke tests documented in quickstart.md.
- 📁 Files: plan.md, research.md, data-model.md, quickstart.md, 4 contract files, CLAUDE.md
- 🔁 Next prompts: /sp.tasks to generate the actionable task list for implementation.
- 🧠 Reflection: User's 9-phase plan mapped cleanly to spec user stories. SELECT FOR UPDATE concurrency pattern added proactively to satisfy SC-007. All constitution gates passed without violations.

## Evaluation notes (flywheel)

- Failure modes observed: PowerShell not available on Linux WSL2 — all script actions replicated via agent-native file tools
- Graders run and results (PASS/FAIL): N/A — plan stage
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): Consider splitting data-model.md migration examples into actual Alembic version files during tasks phase
