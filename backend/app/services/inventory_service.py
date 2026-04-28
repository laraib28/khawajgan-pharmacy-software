from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.medicine import Medicine
from app.models.inventory_log import InventoryLog
from app.models.sale_item import SaleItem
from app.models.stock_receiving import StockReceiving
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
    await db.flush()

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
    if data.price is not None and data.price != medicine.price:
        log = InventoryLog(
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            field_changed="price",
            old_value=str(medicine.price),
            new_value=str(data.price),
        )
        db.add(log)
        medicine.price = data.price

    if data.stock is not None and data.stock != medicine.stock:
        log = InventoryLog(
            medicine_id=medicine.id,
            medicine_name=medicine.name,
            field_changed="stock",
            old_value=str(medicine.stock),
            new_value=str(data.stock),
        )
        db.add(log)
        medicine.stock = data.stock

    medicine.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(medicine)
    logger.info("Updated medicine id=%s", medicine.id)
    return medicine


async def delete_medicine(db: AsyncSession, medicine_id: int) -> None:
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise HTTPException(
            status_code=404,
            detail=f"Medicine with id {medicine_id} not found",
        )
    # Prevent deletion if medicine has sales history
    sale_check = await db.execute(
        select(SaleItem).where(SaleItem.medicine_id == medicine_id).limit(1)
    )
    if sale_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Cannot delete medicine that has sales history. Archive it by setting stock to 0 instead.",
        )
    # Delete related records first
    receivings = await db.execute(select(StockReceiving).where(StockReceiving.medicine_id == medicine_id))
    for r in receivings.scalars().all():
        await db.delete(r)
    logs = await db.execute(select(InventoryLog).where(InventoryLog.medicine_id == medicine_id))
    for l in logs.scalars().all():
        await db.delete(l)
    await db.delete(medicine)
    await db.commit()
    logger.info("Deleted medicine id=%s name=%s", medicine_id, medicine.name)


async def get_medicine_history(
    db: AsyncSession, medicine_id: int
) -> list[InventoryLog]:
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=404,
            detail=f"Medicine with id {medicine_id} not found",
        )
    logs = await db.execute(
        select(InventoryLog)
        .where(InventoryLog.medicine_id == medicine_id)
        .order_by(InventoryLog.changed_at.desc())
    )
    return list(logs.scalars().all())
