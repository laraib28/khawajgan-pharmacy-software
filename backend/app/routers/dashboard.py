from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.database import get_db
from app.models.medicine import Medicine
from app.models.sale import Sale
from app.schemas.dashboard import DashboardStats
from app.schemas.medicine import MedicineOut

router = APIRouter(tags=["dashboard"])

LOW_STOCK_THRESHOLD = 10


@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_medicines = (await db.execute(select(func.count(Medicine.id)))).scalar_one()
    total_sales = (await db.execute(select(func.count(Sale.id)))).scalar_one()
    total_stock = (await db.execute(select(func.coalesce(func.sum(Medicine.stock), 0)))).scalar_one()

    low_stock_result = await db.execute(
        select(Medicine)
        .where(Medicine.stock <= LOW_STOCK_THRESHOLD)
        .order_by(Medicine.stock.asc())
    )
    low_stock = list(low_stock_result.scalars().all())

    return DashboardStats(
        total_medicines=total_medicines,
        total_sales=total_sales,
        total_stock=int(total_stock),
        low_stock_medicines=[MedicineOut.model_validate(m) for m in low_stock],
    )
