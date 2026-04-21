from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class MedicineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)
    stock: int = Field(..., ge=0)
    company: Optional[str] = Field(None, max_length=255)
    composition: Optional[str] = Field(None, max_length=500)
    type: Optional[str] = Field(None, max_length=100)
    uom: Optional[str] = Field(None, max_length=50)
    company_invoice_no: Optional[str] = Field(None, max_length=100)


class MedicineUpdate(BaseModel):
    price: Optional[Decimal] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)


class MedicineOut(BaseModel):
    id: int
    name: str
    price: Decimal
    stock: int
    company: Optional[str]
    composition: Optional[str]
    type: Optional[str]
    uom: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class MedicineCreateOut(MedicineOut):
    receiving_invoice_no: str
    company_invoice_no: Optional[str]
