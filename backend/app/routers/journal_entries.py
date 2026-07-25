from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.journal_entry import AccountBalanceOut, JournalEntryCreate, JournalEntryOut
from app.services import journal_entry_service

router = APIRouter(
    prefix="/journal-entries",
    tags=["journal-entries"],
    dependencies=[Depends(get_current_user)],
)


@router.get("", response_model=List[JournalEntryOut])
async def list_entries(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    source_type: Optional[str] = None,
    account_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    return await journal_entry_service.list_entries(
        db,
        date_from=date_from,
        date_to=date_to,
        source_type=source_type,
        account_id=account_id,
    )


@router.get("/{entry_id}", response_model=JournalEntryOut)
async def get_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    return await journal_entry_service.get_entry(db, entry_id)


@router.post("", response_model=JournalEntryOut, status_code=201)
async def create_entry(
    data: JournalEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await journal_entry_service.create_manual_entry(db, data, current_user.id)


@router.delete("/{entry_id}", status_code=204)
async def delete_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    await journal_entry_service.delete_entry(db, entry_id)


@router.post("/{entry_id}/reverse", response_model=JournalEntryOut)
async def reverse_entry(
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await journal_entry_service.reverse_entry(db, entry_id, current_user.id)
