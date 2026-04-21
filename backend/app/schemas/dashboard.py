from typing import List
from pydantic import BaseModel
from app.schemas.medicine import MedicineOut


class DashboardStats(BaseModel):
    total_medicines: int
    total_sales: int
    total_stock: int
    low_stock_medicines: List[MedicineOut]
