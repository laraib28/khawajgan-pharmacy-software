# API Contract: Medicines

**Module**: Inventory
**Router**: `backend/app/routers/medicines.py`
**Service**: `backend/app/services/inventory_service.py`

---

## POST /medicines — Create Medicine

**Purpose**: Add a new medicine to the catalogue.

### Request

```
POST /medicines
Content-Type: application/json
```

```json
{
  "name": "Panadol",
  "price": 50.00,
  "stock": 100,
  "company": "GSK"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| name | string | Yes | 1–255 chars; unique (case-insensitive) |
| price | number | Yes | ≥ 0 |
| stock | integer | Yes | ≥ 0 |
| company | string | No | Nullable; 0–255 chars |

### Response — 201 Created

```json
{
  "id": 1,
  "name": "Panadol",
  "price": 50.00,
  "stock": 100,
  "company": "GSK",
  "created_at": "2026-04-14T10:00:00Z"
}
```

### Error Responses

| Status | Condition | Body |
|---|---|---|
| 400 | Name already exists | `{"detail": "Medicine with name 'Panadol' already exists"}` |
| 422 | Validation failure (price < 0, missing name) | `{"detail": [{"loc": ["body","price"], "msg": "..."}]}` |

---

## GET /medicines — List / Search Medicines

**Purpose**: Return all medicines. Supports partial name search.

### Request

```
GET /medicines
GET /medicines?search=pan
```

| Query Param | Type | Required | Description |
|---|---|---|---|
| search | string | No | Case-insensitive partial match on name |

### Response — 200 OK

```json
[
  {
    "id": 1,
    "name": "Panadol",
    "price": 50.00,
    "stock": 100,
    "company": "GSK",
    "created_at": "2026-04-14T10:00:00Z"
  }
]
```

Returns empty array `[]` if no medicines or no matches found.

---

## PUT /medicines/{id} — Update Medicine

**Purpose**: Update price and/or stock of an existing medicine.

### Request

```
PUT /medicines/{id}
Content-Type: application/json
```

```json
{
  "price": 60.00,
  "stock": 150
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| price | number | No | ≥ 0 |
| stock | integer | No | ≥ 0 |

At least one field must be provided.

### Response — 200 OK

```json
{
  "id": 1,
  "name": "Panadol",
  "price": 60.00,
  "stock": 150,
  "company": "GSK",
  "created_at": "2026-04-14T10:00:00Z"
}
```

### Error Responses

| Status | Condition | Body |
|---|---|---|
| 404 | Medicine ID not found | `{"detail": "Medicine with id 99 not found"}` |
| 422 | Validation failure (price < 0) | `{"detail": [{"loc": ["body","price"], "msg": "..."}]}` |

---

## Idempotency & Safety

- `POST /medicines`: NOT idempotent — duplicate names return 400.
- `GET /medicines`: Safe and idempotent.
- `PUT /medicines/{id}`: Idempotent — same call produces same result.
