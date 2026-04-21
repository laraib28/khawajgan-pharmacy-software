from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.medicine import Medicine
from app.schemas.medicine import MedicineCreate, MedicineUpdate
from app.services import receiving_service
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def list_medicines(
    db: AsyncSession, search: Optional[str] = None
) -> list[Medicine]:
    stmt = select(Medicine)
    if search:
        stmt = stmt.where(func.lower(Medicine.name).contains(search.lower()))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_medicine(db: AsyncSession, data: MedicineCreate) -> dict:
    # Case-insensitive duplicate check
    exists = await db.execute(
        select(Medicine).where(func.lower(Medicine.name) == data.name.lower())
    )
    if exists.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Medicine with name '{data.name}' already exists",
        )
    medicine = Medicine(
        name=data.name,
        price=data.price,
        stock=data.stock,
        company=data.company,
        composition=data.composition,
        type=data.type,
        uom=data.uom,
    )
    db.add(medicine)
    await db.flush()  # get medicine.id before creating receiving record

    receiving = await receiving_service.create_receiving(
        db,
        medicine_id=medicine.id,
        medicine_name=medicine.name,
        quantity=data.stock,
        company_invoice_no=data.company_invoice_no,
    )
    await db.commit()
    await db.refresh(medicine)
    await db.refresh(receiving)
    logger.info("Created medicine id=%s name=%s receiving=%s", medicine.id, medicine.name, receiving.invoice_no)
    return {
        **{c.name: getattr(medicine, c.name) for c in medicine.__table__.columns},
        "receiving_invoice_no": receiving.invoice_no,
        "company_invoice_no": receiving.company_invoice_no,
    }


async def update_medicine(
    db: AsyncSession, medicine_id: int, data: MedicineUpdate
) -> Medicine:
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise HTTPException(
            status_code=404,
            detail=f"Medicine with id {medicine_id} not found",
        )
    if data.price is not None:
        medicine.price = data.price
    if data.stock is not None:
        medicine.stock = data.stock
    await db.commit()
    await db.refresh(medicine)
    logger.info("Updated medicine id=%s", medicine.id)
    return medicine
