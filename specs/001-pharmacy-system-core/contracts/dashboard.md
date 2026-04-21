# API Contract: Admin Dashboard

**Module**: Admin Dashboard
**Router**: `backend/app/routers/dashboard.py`

---

## GET /dashboard/stats — System Statistics

**Purpose**: Return aggregate counts for the admin dashboard overview with low-stock alerts.

### Request

```
GET /dashboard/stats
```

No query parameters. No request body.

### Response — 200 OK

```json
{
  "total_medicines": 42,
  "total_sales": 157,
  "total_stock": 4820,
  "low_stock_medicines": [
    {
      "id": 5,
      "name": "Aspirin",
      "price": 25.00,
      "stock": 3,
      "company": "Bayer",
      "created_at": "2026-04-01T08:00:00Z"
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| total_medicines | integer | COUNT of distinct medicines in the catalogue |
| total_sales | integer | COUNT of all sales records |
| total_stock | integer | SUM of `stock` across all medicines |
| low_stock_medicines | array | Medicines where `stock <= 10` (low-stock threshold) |

### SQL Equivalent

```sql
SELECT
  (SELECT COUNT(*) FROM medicines)          AS total_medicines,
  (SELECT COUNT(*) FROM sales)              AS total_sales,
  (SELECT COALESCE(SUM(stock), 0) FROM medicines) AS total_stock;

SELECT * FROM medicines WHERE stock <= 10 ORDER BY stock ASC;
```

### Performance Target

Response within 1 second (per SC-006 — dashboard reflects state within 5 seconds of any update).
Query uses COUNT/SUM aggregates; no full table scans of sale_items required.

### Error Responses

| Status | Condition | Body |
|---|---|---|
| 500 | DB unavailable | `{"detail": "Internal server error"}` |

### Idempotency

Safe and idempotent. Multiple identical calls return consistent results for the same DB state.

---

## Low-Stock Threshold

- Default threshold: `stock <= 10` (per Assumption A-002)
- Not configurable via UI in v1
- `low_stock_medicines` list is sorted by `stock ASC` (lowest first) to prioritise attention
