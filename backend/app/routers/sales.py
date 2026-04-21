from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.sale import InvoiceOut, SaleCreate
from app.services import billing_service

router = APIRouter(tags=["sales"])


@router.post("/sale", response_model=InvoiceOut)
async def create_sale(
    data: SaleCreate,
    db: AsyncSession = Depends(get_db),
):
    return await billing_service.create_sale(db, data)
