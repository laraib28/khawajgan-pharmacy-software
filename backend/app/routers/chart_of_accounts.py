from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.schemas.chart_of_account import (
    ChartOfAccountCreate,
    ChartOfAccountOut,
    ChartOfAccountUpdate,
)
from app.services import chart_of_account_service

router = APIRouter(prefix="/chart-of-accounts", tags=["chart-of-accounts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[ChartOfAccountOut])
async def list_accounts(
    account_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
):
    return await chart_of_account_service.list_accounts(db, account_type=account_type, is_active=is_active)


@router.get("/{account_id}", response_model=ChartOfAccountOut)
async def get_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await chart_of_account_service.get_account(db, account_id)


@router.post("", response_model=ChartOfAccountOut, status_code=201)
async def create_account(
    data: ChartOfAccountCreate,
    db: AsyncSession = Depends(get_db),
):
    return await chart_of_account_service.create_account(db, data)


@router.put("/{account_id}", response_model=ChartOfAccountOut)
async def update_account(
    account_id: int,
    data: ChartOfAccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await chart_of_account_service.update_account(db, account_id, data)


@router.delete("/{account_id}", status_code=204)
async def deactivate_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
):
    await chart_of_account_service.deactivate_account(db, account_id)
