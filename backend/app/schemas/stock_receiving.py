from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class StockReceivingCreate(BaseModel):
    medicine_id: int
    quantity: int = Field(..., gt=0)
    company_invoice_no: Optional[str] = Field(None, max_length=100)
    supplier_name: Optional[str] = Field(None, max_length=255)


class StockReceivingOut(BaseModel):
    id: int
    invoice_no: str
    company_invoice_no: Optional[str]
    supplier_name: Optional[str]
    medicine_id: int
    medicine_name: str
    quantity: int
    received_at: datetime

    model_config = {"from_attributes": True}
