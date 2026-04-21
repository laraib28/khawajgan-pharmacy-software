from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.stock_receiving import StockReceivingOut
from app.services import receiving_service

router = APIRouter(prefix="/receiving", tags=["receiving"])


@router.get("", response_model=List[StockReceivingOut])
async def list_receivings(db: AsyncSession = Depends(get_db)):
    return await receiving_service.list_receivings(db)
