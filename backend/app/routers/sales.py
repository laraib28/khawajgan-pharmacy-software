from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.sale import InvoiceOut, SaleCreate, SaleOut
from app.services import billing_service

router = APIRouter(tags=["sales"], dependencies=[Depends(get_current_user)])


@router.get("/sales", response_model=List[SaleOut])
async def list_sales(db: AsyncSession = Depends(get_db)):
    return await billing_service.list_sales(db)


@router.post("/sale", response_model=InvoiceOut)
async def create_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await billing_service.create_sale(db, data, created_by_id=current_user.id)
