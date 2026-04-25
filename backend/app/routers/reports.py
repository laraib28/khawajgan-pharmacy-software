from fastapi import APIRouter, Depends, Query
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.medicine import Medicine
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.stock_receiving import StockReceiving

router = APIRouter(prefix="/reports", tags=["reports"])


class MonthlyMedicineReport(BaseModel):
    medicine_id: int
    medicine_name: str
    current_stock: int
    received_qty: int
    sold_qty: int


@router.get("/monthly", response_model=list[MonthlyMedicineReport])
async def monthly_report(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    received_sub = (
        select(
            StockReceiving.medicine_id,
            func.coalesce(func.sum(StockReceiving.quantity), 0).label("received_qty"),
        )
        .where(
            extract("year", StockReceiving.received_at) == year,
            extract("month", StockReceiving.received_at) == month,
        )
        .group_by(StockReceiving.medicine_id)
        .subquery()
    )

    sold_sub = (
        select(
            SaleItem.medicine_id,
            func.coalesce(func.sum(SaleItem.quantity), 0).label("sold_qty"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(
            extract("year", Sale.created_at) == year,
            extract("month", Sale.created_at) == month,
        )
        .group_by(SaleItem.medicine_id)
        .subquery()
    )

    stmt = (
        select(
            Medicine.id.label("medicine_id"),
            Medicine.name.label("medicine_name"),
            Medicine.stock.label("current_stock"),
            func.coalesce(received_sub.c.received_qty, 0).label("received_qty"),
            func.coalesce(sold_sub.c.sold_qty, 0).label("sold_qty"),
        )
        .outerjoin(received_sub, Medicine.id == received_sub.c.medicine_id)
        .outerjoin(sold_sub, Medicine.id == sold_sub.c.medicine_id)
        .order_by(Medicine.name)
    )

    result = await db.execute(stmt)
    rows = result.mappings().all()
    return [MonthlyMedicineReport(**row) for row in rows]
