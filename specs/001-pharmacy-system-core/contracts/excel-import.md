# API Contract: Excel Import

**Module**: Excel Import
**Router**: `backend/app/routers/upload.py`
**Utility**: `backend/app/utils/excel_parser.py`

---

## POST /upload-excel — Bulk Medicine Import

**Purpose**: Accept an `.xlsx` file, validate its structure, clean the data, and bulk-insert
medicines that do not already exist in the database.

### Request

```
POST /upload-excel
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|---|---|---|---|
| file | file upload | Yes | `.xlsx` file only |

### Required Columns in File

| Column | Type | Nullable? | On Null |
|---|---|---|---|
| name | string | No | Reject row |
| price | number | No | Reject row |
| stock | integer | No | Reject row |
| company | string | Yes | Default to `""` |

### Processing Steps

```
1. Validate file extension = .xlsx           → reject if not (415 Unsupported Media Type)
2. Read with pandas (openpyxl engine)
3. Validate required columns present         → 422 if missing, list missing columns
4. Drop rows where name / price / stock null → count as errors
5. Fill null company with ""
6. Drop duplicate names (keep first)         → count as skipped
7. For each remaining row:
   a. Check if medicine.name already in DB   → skip if exists (count as skipped)
   b. INSERT medicine
8. Commit bulk insert
9. Return summary
```

### Response — 200 OK

```json
{
  "inserted": 8,
  "skipped": 3,
  "errors": [
    { "row": 4, "reason": "price is null" },
    { "row": 7, "reason": "stock is null" }
  ]
}
```

| Field | Description |
|---|---|
| inserted | Number of new medicines successfully written to DB |
| skipped | Number of rows ignored (duplicates within file + already-in-DB) |
| errors | Rows with invalid/null required fields; skipped with reason |

### Error Responses

| Status | Condition | Body |
|---|---|---|
| 415 | File is not .xlsx | `{"detail": "Only .xlsx files are accepted"}` |
| 422 | Missing required columns | `{"detail": "Missing required columns: price, stock"}` |
| 200 | No rows inserted (all skipped/errored) | `{"inserted": 0, "skipped": N, "errors": [...], "message": "No valid records to import"}` |
| 500 | DB failure | `{"detail": "Internal server error"}` + all inserts rolled back |

### Constraints

- Existing medicines are NEVER overwritten (per FR-019).
- Duplicate names within the file: first occurrence wins, rest skipped.
- Price < 0 in the file: reject that row (counted as error), continue processing others.
- Stock < 0 in the file: reject that row (counted as error), continue processing others.
- Entire import is wrapped in one DB transaction; if the transaction fails, no partial rows persist.
