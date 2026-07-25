from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.stock_receiving import StockReceivingCreate, StockReceivingOut
from app.services import receiving_service

router = APIRouter(prefix="/receiving", tags=["receiving"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[StockReceivingOut])
async def list_receivings(db: AsyncSession = Depends(get_db)):
    return await receiving_service.list_receivings(db)


@router.post("", response_model=StockReceivingOut, status_code=201)
async def add_receiving(data: StockReceivingCreate, db: AsyncSession = Depends(get_db)):
    return await receiving_service.restock_medicine(
        db, data.medicine_id, data.quantity, data.company_invoice_no
    )
