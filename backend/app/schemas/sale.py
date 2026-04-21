from datetime import datetime
from decimal import Decimal
from typing import List
from pydantic import BaseModel, Field


class SaleItemInput(BaseModel):
    medicine_id: int
    quantity: int = Field(..., ge=1)


class SaleCreate(BaseModel):
    patient_name: str = Field(..., min_length=1, max_length=255)
    items: List[SaleItemInput] = Field(..., min_length=1)


class InvoiceItem(BaseModel):
    name: str
    quantity: int
    price: Decimal
    amount: Decimal  # quantity × price — stock is NEVER included


class InvoiceOut(BaseModel):
    sale_id: int
    patient_name: str
    created_at: datetime
    items: List[InvoiceItem]
    total_amount: Decimal
