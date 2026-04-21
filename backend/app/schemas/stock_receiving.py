from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class StockReceivingOut(BaseModel):
    id: int
    invoice_no: str
    company_invoice_no: Optional[str]
    medicine_id: int
    medicine_name: str
    quantity: int
    received_at: datetime

    model_config = {"from_attributes": True}
