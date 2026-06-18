from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.sale import InvoiceOut, SaleCreate, SaleOut
from app.services import billing_service

router = APIRouter(tags=["sales"])


@router.get("/sales", response_model=List[SaleOut])
async def list_sales(db: AsyncSession = Depends(get_db)):
    return await billing_service.list_sales(db)


@router.post("/sale", response_model=InvoiceOut)
async def create_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
):
    return await billing_service.create_sale(db, data)
