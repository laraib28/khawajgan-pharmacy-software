# API Contract: Sales (Billing)

**Module**: Billing
**Router**: `backend/app/routers/sales.py`
**Service**: `backend/app/services/billing_service.py`

---

## POST /sale — Create Sale

**Purpose**: Process a complete sale transaction. Validates stock, deducts atomically,
records the sale and all line items, and returns an invoice payload.

### Request

```
POST /sale
Content-Type: application/json
```

```json
{
  "patient_name": "Ali Ahmed",
  "items": [
    { "medicine_id": 1, "quantity": 2 },
    { "medicine_id": 3, "quantity": 1 }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| patient_name | string | Yes | 1–255 chars |
| items | array | Yes | Min 1 item |
| items[].medicine_id | integer | Yes | Must reference existing medicine |
| items[].quantity | integer | Yes | ≥ 1 (per FR-012) |

### Processing (atomic transaction)

```
BEGIN TRANSACTION
  FOR EACH item:
    SELECT medicine FOR UPDATE                  ← row-lock for concurrency safety
    IF medicine.stock < item.quantity:
      ROLLBACK
      RETURN 400 "Insufficient stock for <name>: requested <N>, available <M>"
  FOR EACH item:
    UPDATE medicines SET stock = stock - quantity WHERE id = item.medicine_id
  INSERT INTO sales (patient_name, total_amount) VALUES (...)
  INSERT INTO sale_items (sale_id, medicine_id, quantity, price) FOR EACH item
  COMMIT
RETURN invoice payload
```

### Response — 200 OK

```json
{
  "sale_id": 10,
  "patient_name": "Ali Ahmed",
  "created_at": "2026-04-14T11:30:00Z",
  "items": [
    {
      "name": "Panadol",
      "quantity": 2,
      "price": 50.00,
      "amount": 100.00
    },
    {
      "name": "Brufen",
      "quantity": 1,
      "price": 90.00,
      "amount": 90.00
    }
  ],
  "total_amount": 190.00
}
```

**Invoice constraints** (per FR-011):
- Response MUST NOT include `stock` at any level.
- `price` and `amount` reflect values at time of sale; they are permanent snapshots.

### Error Responses

| Status | Condition | Body |
|---|---|---|
| 400 | Insufficient stock | `{"detail": "Insufficient stock for Panadol: requested 5, available 1"}` |
| 422 | quantity < 1 | `{"detail": [{"loc": ["body","items",0,"quantity"], "msg": "ensure this value is greater than or equal to 1"}]}` |
| 422 | patient_name missing | `{"detail": [{"loc": ["body","patient_name"], "msg": "field required"}]}` |
| 422 | medicine_id not found | `{"detail": "Medicine with id 99 not found"}` |
| 500 | DB failure during commit | `{"detail": "Internal server error"}` + rollback guaranteed |

### Concurrency Behaviour

- Multiple concurrent `POST /sale` calls for the same medicine are serialised via
  `SELECT ... FOR UPDATE` — the slower request waits, re-reads the updated stock,
  and proceeds or fails based on the new value.
- Satisfies **SC-007**: 10 concurrent submissions without stock inconsistency.

---

## Idempotency

`POST /sale` is NOT idempotent. Each call creates a new sale record. No retry-safe idempotency
key is implemented in v1 (authentication and idempotency keys are future enhancements).
