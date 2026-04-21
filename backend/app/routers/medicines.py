from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.medicine import MedicineCreate, MedicineCreateOut, MedicineOut, MedicineUpdate
from app.services import inventory_service

router = APIRouter(prefix="/medicines", tags=["medicines"])


@router.get("", response_model=List[MedicineOut])
async def list_medicines(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    return await inventory_service.list_medicines(db, search=search)


@router.post("", response_model=MedicineCreateOut, status_code=201)
async def create_medicine(
    data: MedicineCreate,
    db: AsyncSession = Depends(get_db),
):
    return await inventory_service.create_medicine(db, data)


@router.put("/{medicine_id}", response_model=MedicineOut)
async def update_medicine(
    medicine_id: int,
    data: MedicineUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await inventory_service.update_medicine(db, medicine_id, data)
